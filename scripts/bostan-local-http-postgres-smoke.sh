#!/bin/bash
set -euo pipefail
if [ "${1:-}" = "--help" ] && [ "$#" -eq 1 ]; then
  echo "Bostan isolated localhost HTTP + PostgreSQL startup smoke (no Rust)."
  echo "Run with: bash scripts/bostan-local-http-postgres-smoke.sh --run"
  echo "Or private compiled JavaScript: bash scripts/bostan-local-http-postgres-smoke.sh --run-dist"
  echo "Or built JS + actual synthetic private Better Auth sessions: bash scripts/bostan-local-http-postgres-smoke.sh --run-dist-authz"
  echo "Or SHA-owned packed runtime + real private Better Auth/PG: bash scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz"
  echo "Or isolated private staged production bundle: bash scripts/bostan-local-http-postgres-smoke.sh --run-deployed <absolute-stage>"
  echo "Or isolated authenticated production sessions: bash scripts/bostan-local-http-postgres-smoke.sh --run-deployed-authz <absolute-stage>"
  echo "Or synthetic eight-caller private first-admin race: --run-deployed-admin-race <absolute-stage>"
  echo "Prerequisites: installed pnpm server/database workspace dependencies,"
  echo "prebuilt @bostan/shared, @bostan/plugin-sdk and @bostan/runner TypeScript."
  echo "Requires local PostgreSQL CLI tools; no paid models or remote services."
  exit 0
fi
if ! { [ "$#" -eq 1 ] && { [ "$1" = "--run" ] || [ "$1" = "--run-dist" ] || [ "$1" = "--run-dist-authz" ] || [ "$1" = "--run-packed-authz" ]; }; } && ! { [ "$#" -eq 2 ] && { [ "$1" = "--run-deployed" ] || [ "$1" = "--run-deployed-authz" ] || [ "$1" = "--run-deployed-authz-ui" ] || [ "$1" = "--run-deployed-admin-race" ]; }; }; then
  echo "Usage: bash scripts/bostan-local-http-postgres-smoke.sh [--help|--run|--run-dist|--run-dist-authz|--run-packed-authz|--run-deployed <absolute-stage>|--run-deployed-authz <absolute-stage>|--run-deployed-authz-ui <absolute-stage>|--run-deployed-admin-race <absolute-stage>]" >&2
  exit 2
fi
umask 077
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# Before creating any temporary DB/stage artifacts, refuse inherited managed
# upstream Cloud settings rather than silently changing deployment semantics.
# This QA runner is localhost/self-hosted only. No actual Cloud mode is tested.
node "$REPO/scripts/bostan-private-local-cloud-isolation.mjs" --check
# A built artifact must already exist; never fall back to TypeScript in dist mode.
MODE="$1"
STAGE=""
if [ "$MODE" = "--run-deployed" ] || [ "$MODE" = "--run-deployed-authz" ] || [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-deployed-admin-race" ]; then
  # A different package root must be explicitly verified, and may not link
  # back into the source checkout. This never modifies the staged package.
  case "$2" in /*) ;; *) echo "Bostan standalone stage path must be absolute" >&2; exit 2;; esac
  node "$REPO/scripts/bostan-private-staged-server-check.mjs" --verify "$2" >/dev/null
  STAGE="$(cd "$2" && pwd -P)"
fi
if [ "$MODE" = "--run-dist" ] || [ "$MODE" = "--run-dist-authz" ] || [ "$MODE" = "--run-packed-authz" ] || [ "$MODE" = "--run-packed-authz" ]; then
  for file in "$REPO/server/dist/index.js" "$REPO/server/dist/build-info.json" "$REPO/server/dist/vendor/paperclip-runner/index.js"; do
    if [ ! -f "$file" ]; then
      echo "Bostan compiled-dist smoke: prepared server build missing ($file)" >&2
      exit 2
    fi
  done
fi
if [ "$MODE" = "--run-packed-authz" ]; then
  # The packed runtime is a different SHA256-owned entry, not merely dist/.
  # Admit it with the production verifier before creating scratch databases.
  node --input-type=module - "$REPO" <<'BOSTAN_PACKED_ADMISSION'
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const repo = process.argv[2];
const checker = await import(pathToFileURL(join(repo,"server","scripts",
  "bundle-runtime-output-admission.mjs")).href);
const out = join(repo,"server","dist-runtime");
const verified = await checker.assertSafeRuntimeOutdir(
  join(repo,"server","dist","index.js"),out);
if (verified !== out) throw Error("Bostan packed runtime ownership refused");
console.log("BOSTAN_PACKED_SHA256_RUNTIME_OWNERSHIP_VERIFIED");
BOSTAN_PACKED_ADMISSION
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
# Never inherit an operator-supplied first-admin test override into legacy modes.
unset BOSTAN_AUTHZ_API_FIRST_ADMIN
if [ "$MODE" = "--run-deployed-authz" ] || [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-deployed-admin-race" ] || [ "$MODE" = "--run-dist-authz" ] || [ "$MODE" = "--run-packed-authz" ]; then
  # The new built-server test must prove the first-admin API, not SQL seeding.
  if [ "$MODE" = "--run-dist-authz" ] || [ "$MODE" = "--run-packed-authz" ]; then export BOSTAN_AUTHZ_API_FIRST_ADMIN=1; fi
  export PAPERCLIP_DEPLOYMENT_MODE=authenticated PAPERCLIP_DEPLOYMENT_EXPOSURE=private
  export PAPERCLIP_AUTH_PUBLIC_BASE_URL="http://127.0.0.1:$HTTPPORT" PAPERCLIP_AUTH_BASE_URL_MODE=explicit
  export PAPERCLIP_AUTH_DISABLE_SIGN_UP=false PAPERCLIP_AUTH_RATE_LIMIT_ENABLED=false
  export BETTER_AUTH_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
fi
unset OPENAI_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY GOOGLE_API_KEY OPENROUTER_API_KEY XAI_API_KEY OTEL_EXPORTER_OTLP_ENDPOINT SENTRY_DSN 2>/dev/null || true
cd "$REPO"
if [ "$MODE" = "--run-deployed" ] || [ "$MODE" = "--run-deployed-authz" ] || [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-deployed-admin-race" ]; then
  # Actual compiled migration code and SQL from the deployed package, not the
  # source repo's TSX tooling or migration assets.
  (cd "$STAGE" && node --conditions=bostan-compiled node_modules/@bostan/db/dist/migrate.js) >"$TMP/migrate.log" 2>&1
else
  pnpm --filter @bostan/db migrate >"$TMP/migrate.log" 2>&1
fi
printf 'MIGRATED\n'
if [ "$MODE" = "--run-deployed" ] || [ "$MODE" = "--run-deployed-authz" ] || [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-deployed-admin-race" ]; then
  cd "$STAGE"
  node --conditions=bostan-compiled dist/index.js > "$TMP/server.log" 2>&1 & SPID=$!
else
  cd "$REPO/server"
  if [ "$MODE" = "--run-packed-authz" ]; then
    node "$REPO/server/dist-runtime/index.mjs" > "$TMP/server.log" 2>&1 & SPID=$!
  elif [ "$MODE" = "--run-dist" ] || [ "$MODE" = "--run-dist-authz" ]; then
    node --conditions=bostan-compiled dist/index.js > "$TMP/server.log" 2>&1 & SPID=$!
  else
    node --import tsx src/index.ts > "$TMP/server.log" 2>&1 & SPID=$!
  fi
fi
# The compiled Linux server on a slow mounted WSL workspace may need longer
# to cold-import its dependency graph than a native ext4/Mac build. A narrow
# opt-in allows only an already built disposable Linux compiled-dist process
# extra bounded readiness probes; it never skips PG, auth, or health validation.
HEALTH_ATTEMPTS=90
if [ "$(uname -s)" = Linux ] && [ "$MODE" = --run-dist ] &&   [ "${BOSTAN_LINUX_PRIVATE_COLD_BOOT_QA:-0}" = 1 ] &&   [ "${BOSTAN_LINUX_PRIVATE_TMPFS_QA:-0}" = 1 ]; then
  node "$REPO/scripts/bostan-private-linux-tmpfs-admission.mjs" --check >/dev/null
  HEALTH_ATTEMPTS=300
  echo BOSTAN_LINUX_COLD_BOOT_BOUNDED_QA_ADMITTED
fi
status=0
for i in $(seq 1 "$HEALTH_ATTEMPTS");do
  if ! kill -0 "$SPID" 2>/dev/null; then status=1;break;fi
  if curl -fsS --connect-timeout 1 --max-time 2 "http://127.0.0.1:$HTTPPORT/api/health" >"$TMP/health.json" 2>/dev/null; then
    # HTTP can be available before asynchronous startup recovery reaches ready.
    if [ "$MODE" = "--run-deployed-authz" ] || [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-deployed-admin-race" ] || [ "$MODE" = "--run-dist-authz" ] || [ "$MODE" = "--run-packed-authz" ]; then
      if node --input-type=module -e 'import{readFileSync}from"node:fs";const j=JSON.parse(readFileSync(process.argv[1],"utf8"));process.exit(j.status==="ok"&&j.deploymentMode==="authenticated"&&j.bootstrapStatus==="bootstrap_pending"?0:1)' "$TMP/health.json";then status=2;break;fi
    else
      if node --input-type=module -e 'import{readFileSync}from"node:fs";const j=JSON.parse(readFileSync(process.argv[1],"utf8"));process.exit(j.status==="ok"&&j.bootstrapStatus==="ready"?0:1)' "$TMP/health.json";then status=2;break;fi
    fi
  fi
  if [ $((i % 30)) -eq 0 ]; then
    printf 'BOSTAN_HTTP_BOOT_PENDING attempt=%s/%s process_alive=1\n' "$i" "$HEALTH_ATTEMPTS"
  fi
  sleep 1
done
if [ "$status" = 2 ]; then
  if [ "$MODE" = "--run-deployed-authz" ] || [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-deployed-admin-race" ] || [ "$MODE" = "--run-dist-authz" ] || [ "$MODE" = "--run-packed-authz" ]; then export BOSTAN_AUTHZ_EXPECTED_MODE=1;fi
  node --input-type=module - "$TMP/health.json" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data=JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(data.status, 'ok');
assert.equal(data.deploymentMode, process.env.BOSTAN_AUTHZ_EXPECTED_MODE === '1' ? 'authenticated' : 'local_trusted');
assert.equal(data.deploymentExposure, 'private');
assert.equal(Object.hasOwn(data, 'cloud'), false, 'Private localhost QA must not advertise managed Cloud metadata');
if (process.env.BOSTAN_AUTHZ_EXPECTED_MODE === '1') {
  // Anonymous health intentionally REDACTS authReady and reports the clean,
  // unclaimed instance until a first admin user is bootstrapped.
  assert.equal(data.bootstrapStatus, 'bootstrap_pending');
  assert.equal(data.authReady, undefined);
} else {
  assert.equal(data.authReady, true);
  assert.equal(data.bootstrapStatus, 'ready');
}
console.log(JSON.stringify({kind:'bostan.local-postgres-http-smoke.v1',releaseQualified:false,livePostgres:true,httpStatus:200,health:data.status,mode:data.deploymentMode,exposure:data.deploymentExposure,authReady:data.authReady,bootstrapStatus:data.bootstrapStatus,externalCloudConfigured:false,externalModelsUsed:false},null,2));
NODE
else
  echo "HEALTH_FAILED status=$status attempts=$HEALTH_ATTEMPTS"
  if [ -s "$TMP/server.log" ]; then
    # Synthetic localhost-only diagnostics. No credentials or full env.
    echo BOSTAN_HTTP_STARTUP_DIAGNOSTIC_LOG_PRESENT
    tail -40 "$TMP/server.log"
  else
    echo BOSTAN_HTTP_STARTUP_DIAGNOSTIC_LOG_EMPTY
  fi
  exit 1
fi
# Verify the actual terminal-facing identity on the booted server, not just TS source.
if ! grep -Fq 'bostan' "$TMP/server.log"; then echo 'BOSTAN_BANNER_MISSING'; exit 1; fi
if grep -Fq 'npx paperclipai onboard' "$TMP/server.log"; then echo 'UNSUPPORTED_LEGACY_ONBOARD_COMMAND'; exit 1; fi
echo 'BOSTAN_BOOT_BANNER_QUALIFIED'

if [ "$MODE" = "--run-deployed-admin-race" ]; then
  export BOSTAN_AUTHZ_RACE_HTTP=1
  BOSTAN_TEST_ONLY_SENTINEL="$TMP/BOSTAN_TEMP_OWNED" node "$REPO/scripts/bostan-private-staged-admin-race-e2e.mjs" --run --url "http://127.0.0.1:$HTTPPORT/"
  echo BOSTAN_PORTABLE_STAGED_FIRST_ADMIN_RACE_QUALIFIED
  exit 0
fi
if [ "$MODE" = "--run-deployed-authz" ] || [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-dist-authz" ] || [ "$MODE" = "--run-packed-authz" ]; then
  if [ "$MODE" = "--run-deployed-authz-ui" ]; then export BOSTAN_AUTHZ_BROWSER_UI=1; fi
  BOSTAN_TEST_ONLY_SENTINEL="$TMP/BOSTAN_TEMP_OWNED" node "$REPO/scripts/bostan-private-staged-authz-e2e.mjs" --run --url "http://127.0.0.1:$HTTPPORT/"
  if [ "$MODE" = "--run-packed-authz" ]; then
    echo BOSTAN_PACKED_SERVER_AUTHENTICATED_TWO_SESSION_QUALIFIED
  elif [ "$MODE" = "--run-dist-authz" ]; then
    echo BOSTAN_BUILT_SERVER_AUTHENTICATED_TWO_SESSION_QUALIFIED
  else
    echo BOSTAN_PORTABLE_STAGED_AUTHENTICATED_TWO_SESSION_QUALIFIED
  fi
  exit 0
fi
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
if [ "$MODE" = "--run-deployed" ] || [ "$MODE" = "--run-deployed-authz" ] || [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-deployed-admin-race" ]; then echo BOSTAN_PORTABLE_STAGED_SERVER_HTTP_QUALIFIED; fi
