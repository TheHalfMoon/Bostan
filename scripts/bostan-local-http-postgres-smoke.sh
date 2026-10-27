#!/bin/bash
set -euo pipefail
if [ "${1:-}" = "--help" ] && [ "$#" -eq 1 ]; then
  echo "Bostan isolated localhost HTTP + PostgreSQL startup smoke (no Rust)."
  echo "Run only with: bash scripts/bostan-local-http-postgres-smoke.sh --run"
  echo "Prerequisites: installed pnpm server/database workspace dependencies,"
  echo "prebuilt @bostan/shared, @bostan/plugin-sdk and @bostan/runner TypeScript."
  echo "Requires local PostgreSQL CLI tools; no paid models or remote services."
  exit 0
fi
if [ "$#" -ne 1 ] || [ "$1" != "--run" ]; then
  echo "Usage: bash scripts/bostan-local-http-postgres-smoke.sh [--help|--run]" >&2
  exit 2
fi
umask 077
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TMP=$(mktemp -d /private/tmp/bostan-live-http.XXXXXX)
PGDATA="$TMP/cluster"
PGPORT=$(python3 - <<'PY'
import socket
s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()
PY
)
HTTPPORT=$(python3 - <<'PY'
import socket
s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()
PY
)
SPID=""
STARTED=0
cleanup(){
 local result=$?
 if [ -n "$SPID" ]; then kill -TERM "$SPID" 2>/dev/null || true; wait "$SPID" 2>/dev/null || true;fi
 if [ "$STARTED" = 1 ]; then pg_ctl -D "$PGDATA" -m immediate -w stop >/dev/null 2>&1 || echo 'PG_STOP_FAILED';fi
 if [ -f "$TMP/BOSTAN_TEMP_OWNED" ]; then rm -rf -- "$TMP";fi
 echo "CLEANUP_COMPLETED exit=$result"
}
trap cleanup EXIT
printf 'BOSTAN_TEST_ONLY\n' > "$TMP/BOSTAN_TEMP_OWNED"
mkdir -p "$TMP/sock" "$TMP/bostan-home"
initdb --no-instructions --no-sync --encoding=UTF8 --locale=C --username=bostan_verify --auth-local=trust --auth-host=trust -D "$PGDATA" >"$TMP/initdb.log" 2>&1
pg_ctl -D "$PGDATA" -l "$TMP/postgres.log" -o "-c listen_addresses=127.0.0.1 -c port=$PGPORT -c unix_socket_directories=$TMP/sock -c fsync=off" -w start >/dev/null
STARTED=1
createdb -h 127.0.0.1 -p "$PGPORT" -U bostan_verify bostan_qualification
export DATABASE_URL="postgres://bostan_verify@127.0.0.1:$PGPORT/bostan_qualification"
export PAPERCLIP_HOME="$TMP/bostan-home" PAPERCLIP_CONFIG="$TMP/bostan-config.json" PAPERCLIP_MIGRATION_PROMPT=never PAPERCLIP_MIGRATION_AUTO_APPLY=true
export PAPERCLIP_OPEN_ON_LISTEN=false BOSTAN_FEEDBACK_EXPORT_ENABLED=0 HOST=127.0.0.1 PORT="$HTTPPORT" OTEL_SDK_DISABLED=true
unset OPENAI_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY GOOGLE_API_KEY OPENROUTER_API_KEY XAI_API_KEY OTEL_EXPORTER_OTLP_ENDPOINT SENTRY_DSN 2>/dev/null || true
cd "$REPO"
pnpm --filter @bostan/db migrate >"$TMP/migrate.log" 2>&1
printf 'MIGRATED\n'
cd "$REPO/server"
node --import tsx src/index.ts > "$TMP/server.log" 2>&1 & SPID=$!
status=0
for i in $(seq 1 90);do
  if ! kill -0 "$SPID" 2>/dev/null; then status=1;break;fi
  if curl -fsS --connect-timeout 1 --max-time 2 "http://127.0.0.1:$HTTPPORT/api/health" >"$TMP/health.json" 2>/dev/null; then
    # HTTP can be available before asynchronous startup recovery reaches ready.
    if node --input-type=module -e 'import{readFileSync}from"node:fs";const j=JSON.parse(readFileSync(process.argv[1],"utf8"));process.exit(j.status==="ok"&&j.bootstrapStatus==="ready"?0:1)' "$TMP/health.json";then status=2;break;fi
  fi
  sleep 1
done
if [ "$status" = 2 ]; then
  node --input-type=module - "$TMP/health.json" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data=JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(data.status, 'ok');
assert.equal(data.deploymentMode, 'local_trusted');
assert.equal(data.deploymentExposure, 'private');
assert.equal(data.authReady, true);
assert.equal(data.bootstrapStatus, 'ready');
console.log(JSON.stringify({kind:'bostan.local-postgres-http-smoke.v1',releaseQualified:false,livePostgres:true,httpStatus:200,health:data.status,mode:data.deploymentMode,exposure:data.deploymentExposure,authReady:data.authReady,bootstrapStatus:data.bootstrapStatus,externalModelsUsed:false},null,2));
NODE
else
  echo "HEALTH_FAILED status=$status";tail -40 "$TMP/server.log";exit 1
fi
