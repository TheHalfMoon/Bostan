#!/usr/bin/env bash
# Private, synthetic-only Linux QA of an already compiled Bostan server
# deployed into a real Linux tmpfs. Not an installer or a release qualification.
set -euo pipefail
if [ "$#" -eq 0 ] || { [ "$#" -eq 1 ] && [ "$1" = --plan ]; }; then
  echo 'Bostan native Linux private prebuilt-stage qualification: --run-authz, --run-admin-race or --run-authz-ui is explicit.'
  echo 'Requires matching compiled JS build, official native dependencies,'
  echo 'isolated /tmp tmpfs, real PostgreSQL, production UI and two signed-in users.'
  echo 'Never deploy to users or publish; no paid providers or production data.'
  exit 0
fi
if [ "$#" -ne 1 ] || { [ "$1" != --run-authz ] && [ "$1" != --run-admin-race ] && [ "$1" != --run-authz-ui ]; }; then
  echo 'Usage: bash scripts/bostan-private-linux-native-prebuilt-stage-authz.sh [--plan|--run-authz|--run-admin-race|--run-authz-ui]' >&2
  exit 2
fi
MODE="$1"
if [ "$(uname -s)" != Linux ] || [ "${BOSTAN_LINUX_PRIVATE_TMPFS_QA:-0}" != 1 ]; then
  echo 'Bostan native Linux staged QA must be explicitly admitted on Linux' >&2
  exit 2
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"
export DO_NOT_TRACK=1 OTEL_SDK_DISABLED=true BOSTAN_FEEDBACK_EXPORT_ENABLED=0 npm_config_offline=true
unset OPENAI_API_KEY ANTHROPIC_API_KEY OPENROUTER_API_KEY GEMINI_API_KEY GOOGLE_API_KEY XAI_API_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY SENTRY_DSN OTEL_EXPORTER_OTLP_ENDPOINT 2>/dev/null || true
umask 077
for prerequisite in node pnpm initdb pg_ctl createdb curl git; do
  command -v "$prerequisite" >/dev/null || { echo "Bostan QA missing $prerequisite" >&2;exit 2; }
done
TMP_ROOT="$(node scripts/bostan-private-staged-server-check.mjs --stage-root)"
if [ "$TMP_ROOT" != /tmp ] || [ -L "$TMP_ROOT" ];then
  echo 'Bostan QA refuses non-canonical Linux staging path' >&2;exit 2
fi
node scripts/bostan-private-linux-tmpfs-admission.mjs --check
node scripts/bostan-private-linux-native-build-closure.mjs --check
node scripts/bostan-private-bundled-font-license-gate.mjs --check
free_kib="$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')"
if ! [[ "$free_kib" =~ ^[0-9]+$ ]] || [ "$free_kib" -lt 4194304 ]; then
  echo 'Bostan QA requires 4 GiB free in original checkout volume' >&2;exit 2
fi
for file in server/dist/index.js server/dist/build-info.json \
  server/dist/vendor/paperclip-runner/index.js \
  packages/db/dist/migrations/meta/_journal.json; do
  test -f "$file" || { echo "Bostan QA compiled artifact missing: $file" >&2;exit 2; }
done
# Built runtime must correspond to this tracked product source, except for
# later documentation/test-only commits. This is not a security release audit.
build_commit="$(node -e 'const d=require("./server/dist/build-info.json");if(!/^[0-9a-f]{40}$/.test(d.commit))process.exit(2);process.stdout.write(d.commit)')"
git merge-base --is-ancestor "$build_commit" HEAD || { echo 'Bostan QA compiled commit is not in source ancestry' >&2;exit 2; }
git diff --quiet "$build_commit" HEAD -- server ui packages package.json pnpm-lock.yaml pnpm-workspace.yaml || {
  echo 'Bostan QA compiled product differs from tracked source' >&2;exit 2;
}
node server/scripts/verify-runner-vendor-dependencies.mjs
echo BOSTAN_LINUX_PREBUILT_SOURCE_ADMISSION_PASS
STAGE=''
cleanup(){
  result=$?
  trap - EXIT INT TERM
  if [ -n "$STAGE" ] && [ -d "$STAGE" ] && [ ! -L "$STAGE" ];then
    case "$STAGE" in "$TMP_ROOT"/bostan-staged-server-????????)
      rm -rf -- "$STAGE" || echo 'BOSTAN_QA_STAGE_CLEANUP_FAILED' >&2;;
      *) echo 'BOSTAN_QA_UNEXPECTED_STAGE_NOT_DELETED' >&2;;
    esac
  fi
  echo "BOSTAN_LINUX_NATIVE_QA_CLEANUP exit=$result"
  exit "$result"
}
trap cleanup EXIT INT TERM
pnpm --filter @bostan/ui build
PAPERCLIP_RELEASE_REUSE_UI_DIST=1 bash scripts/prepare-server-ui-dist.sh
STAGE="$(mktemp -d "$TMP_ROOT/bostan-staged-server-XXXXXXXX")"
pnpm --filter @bostan/server deploy --prod --offline --ignore-scripts "$STAGE"
node scripts/bostan-private-staged-server-check.mjs --repair-owned-self-link "$STAGE" --source-checkout "$ROOT"
node scripts/bostan-private-staged-server-check.mjs --verify "$STAGE"
test -f "$STAGE/ui-dist/index.html" || { echo 'Bostan QA staged UI missing' >&2;exit 1; }
node scripts/bostan-private-bundled-font-license-gate.mjs --verify-stage "$STAGE/ui-dist"
echo BOSTAN_LINUX_NATIVE_TMPFS_STAGE_VERIFIED
if [ "$MODE" = --run-admin-race ]; then
  # Eight independent real signed-in HTTP claimants; exactly one committed
  # administrator, seven conflict responses, eight replay conflicts.
  bash scripts/bostan-local-http-postgres-smoke.sh --run-deployed-admin-race "$STAGE"
  echo BOSTAN_LINUX_NATIVE_STAGED_POSTGRES_FIRST_ADMIN_RACE_PASS
elif [ "$MODE" = --run-authz-ui ]; then
  # The same private authenticated PostgreSQL HTTP gate also exercises actual
  # Chromium first-user signup, first-admin claim and Members/Invites UI.
  # Playwright must be available already; no browser download or install here.
  node --input-type=module -e "import('@playwright/test').then(m=>{if(!m.chromium)process.exitCode=2})" >/dev/null
  bash scripts/bostan-local-http-postgres-smoke.sh --run-deployed-authz-ui "$STAGE"
  echo BOSTAN_LINUX_NATIVE_STAGED_CHROMIUM_AUTHZ_UI_PASS
else
  bash scripts/bostan-local-http-postgres-smoke.sh --run-deployed-authz "$STAGE"
  echo BOSTAN_LINUX_NATIVE_STAGED_POSTGRES_AUTHZ_PASS
fi
