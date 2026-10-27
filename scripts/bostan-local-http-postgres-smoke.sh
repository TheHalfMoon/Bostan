#!/bin/bash
set -euo pipefail
if [ "${1:-}" = "--help" ] && [ "$#" -eq 1 ]; then
  echo "Bostan isolated localhost HTTP + PostgreSQL startup smoke (no Rust)."
  echo "Run with: bash scripts/bostan-local-http-postgres-smoke.sh --run"
  echo "Or private compiled JavaScript: bash scripts/bostan-local-http-postgres-smoke.sh --run-dist"
  echo "Or isolated private staged production bundle: bash scripts/bostan-local-http-postgres-smoke.sh --run-deployed <absolute-stage>"
  echo "Prerequisites: installed pnpm server/database workspace dependencies,"
  echo "prebuilt @bostan/shared, @bostan/plugin-sdk and @bostan/runner TypeScript."
  echo "Requires local PostgreSQL CLI tools; no paid models or remote services."
  exit 0
fi
if ! { [ "$#" -eq 1 ] && { [ "$1" = "--run" ] || [ "$1" = "--run-dist" ]; }; } && ! { [ "$#" -eq 2 ] && [ "$1" = "--run-deployed" ]; }; then
  echo "Usage: bash scripts/bostan-local-http-postgres-smoke.sh [--help|--run|--run-dist|--run-deployed <absolute-stage>]" >&2
  exit 2
fi
umask 077
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# A built artifact must already exist; never fall back to TypeScript in dist mode.
MODE="$1"
STAGE=""
if [ "$MODE" = "--run-deployed" ]; then
  # A different package root must be explicitly verified, and may not link
  # back into the source checkout. This never modifies the staged package.
  case "$2" in /*) ;; *) echo "Bostan standalone stage path must be absolute" >&2; exit 2;; esac
  node "$REPO/scripts/bostan-private-staged-server-check.mjs" --verify "$2" >/dev/null
  STAGE="$(cd "$2" && pwd -P)"
fi
if [ "$MODE" = "--run-dist" ]; then
  for file in "$REPO/server/dist/index.js" "$REPO/server/dist/build-info.json" "$REPO/server/dist/vendor/paperclip-runner/index.js"; do
    if [ ! -f "$file" ]; then
      echo "Bostan compiled-dist smoke: prepared server build missing ($file)" >&2
      exit 2
    fi
  done
fi
# Use the same strict platform system temp root as the staging checker.
# Linux may not provide /private/tmp, and TMPDIR can point into HOME.
TMP_ROOT="$(node "$REPO/scripts/bostan-private-staged-server-check.mjs" --stage-root)"
if [ ! -d "$TMP_ROOT" ] || [ -L "$TMP_ROOT" ]; then
  echo 'Bostan private HTTP smoke refused unexpected temp root' >&2
  exit 2
fi
free_kib="$(df -Pk "$TMP_ROOT" | awk 'NR==2 {print $4}')"
if ! [[ "$free_kib" =~ ^[0-9]+$ ]] || [ "$free_kib" -lt 524288 ]; then
  echo 'Bostan private HTTP smoke refused: requires 512 MiB free on PostgreSQL temp filesystem' >&2
  exit 2
fi
TMP="$(mktemp -d "$TMP_ROOT/bostan-live-http.XXXXXX")"
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
 if [ -f "$TMP/BOSTAN_TEMP_OWNED" ] && [ -d "$TMP" ] && [ ! -L "$TMP" ]; then
   case "$TMP" in "$TMP_ROOT"/bostan-live-http.??????) rm -rf -- "$TMP";;
     *) echo 'BOSTAN_HTTP_UNEXPECTED_TEMP_NOT_DELETED' >&2;;
   esac
 fi
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
if [ "$MODE" = "--run-deployed" ]; then
  # Actual compiled migration code and SQL from the deployed package, not the
  # source repo's TSX tooling or migration assets.
  (cd "$STAGE" && node --conditions=bostan-compiled node_modules/@bostan/db/dist/migrate.js) >"$TMP/migrate.log" 2>&1
else
  pnpm --filter @bostan/db migrate >"$TMP/migrate.log" 2>&1
fi
printf 'MIGRATED\n'
if [ "$MODE" = "--run-deployed" ]; then
  cd "$STAGE"
  node --conditions=bostan-compiled dist/index.js > "$TMP/server.log" 2>&1 & SPID=$!
else
  cd "$REPO/server"
  if [ "$MODE" = "--run-dist" ]; then
  node --conditions=bostan-compiled dist/index.js > "$TMP/server.log" 2>&1 & SPID=$!
else
  node --import tsx src/index.ts > "$TMP/server.log" 2>&1 & SPID=$!
  fi
fi
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
# Verify the actual terminal-facing identity on the booted server, not just TS source.
if ! grep -Fq 'bostan' "$TMP/server.log"; then echo 'BOSTAN_BANNER_MISSING'; exit 1; fi
if grep -Fq 'npx paperclipai onboard' "$TMP/server.log"; then echo 'UNSUPPORTED_LEGACY_ONBOARD_COMMAND'; exit 1; fi
echo 'BOSTAN_BOOT_BANNER_QUALIFIED'

if [ "$MODE" = "--run-dist" ]; then echo BOSTAN_BUILT_SERVER_LOCAL_HTTP_QUALIFIED; fi
if [ "$MODE" = "--run-deployed" ] && [ -f "$STAGE/ui-dist/index.html" ]; then
  # Real SPA static delivery must use the package's own Vite assets, not the
  # repo source fallback. Inspect security headers and a hashed JS asset.
  curl -fsS --connect-timeout 2 --max-time 10 -D "$TMP/ui.headers" \
    "http://127.0.0.1:$HTTPPORT/" -o "$TMP/ui.html"
  if ! grep -Fq '<title>Bostan</title>' "$TMP/ui.html" || \
    ! grep -iq '^referrer-policy: no-referrer' "$TMP/ui.headers"; then
    echo 'BOSTAN_PORTABLE_UI_FIRST_PAINT_PRIVACY_FAILED' >&2
    exit 1
  fi
  ASSET="$(node --input-type=module -e '
    import{readFileSync}from"node:fs";
    const html=readFileSync(process.argv[1],"utf8");
    const asset=html.match(/<script[^>]*src="(\/assets\/[^"\s]+\.js)"/);
    if(!asset)process.exit(2);
    console.log(asset[1]);
  ' "$TMP/ui.html")"
  curl -fsS --connect-timeout 2 --max-time 10 -D "$TMP/asset.headers" \
    "http://127.0.0.1:$HTTPPORT$ASSET" -o "$TMP/asset.js"
  if [ ! -s "$TMP/asset.js" ] || ! grep -iq '^content-type:.*javascript' "$TMP/asset.headers"; then
    echo 'BOSTAN_PORTABLE_UI_HASHED_ASSET_FAILED' >&2
    exit 1
  fi
  MISSING_STATUS="$(curl -sS --connect-timeout 2 --max-time 10 -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:$HTTPPORT/assets/bostan-nonexistent-qualification.js")"
  if [ "$MISSING_STATUS" != 404 ]; then
    echo 'BOSTAN_PORTABLE_UI_MISSING_ASSET_MUST_404' >&2
    exit 1
  fi
  echo BOSTAN_PORTABLE_STAGED_UI_HTTP_QUALIFIED
  if [ "${BOSTAN_STAGE_BROWSER_E2E:-0}" = 1 ]; then
    (cd "$REPO/ui" && node scripts/bostan-private-staged-browser.mjs --run --url "http://127.0.0.1:$HTTPPORT/")
    echo BOSTAN_PORTABLE_STAGED_BROWSER_QUALIFIED
  fi
fi
if [ "$MODE" = "--run-deployed" ] && [ "${BOSTAN_STAGE_CRUD_E2E:-0}" = 1 ]; then
  (cd "$REPO" && node scripts/bostan-private-staged-crud.mjs --run --url "http://127.0.0.1:$HTTPPORT/")
  echo BOSTAN_PORTABLE_STAGED_COMPANY_TASK_API_QUALIFIED
fi
if [ "$MODE" = "--run-deployed" ]; then echo BOSTAN_PORTABLE_STAGED_SERVER_HTTP_QUALIFIED; fi
