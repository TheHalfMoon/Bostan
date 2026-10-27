#!/usr/bin/env bash
# Qualify isolated compiled private Bostan server+UI from a temporary pnpm deploy.
# No user install, publication, user HOME mutation, paid AI or external provider.
set -euo pipefail
if [ "$#" -eq 0 ] || { [ "$#" -eq 1 ] && [ "$1" = --plan ]; }; then
  echo 'Bostan private full-app staged acceptance (macOS/Linux): --run explicitly.'
  echo 'Build frozen offline source JS/UI, deploy private stage with scripts disabled,'
  echo 'repair only generated pnpm self-link, check all symlinks internal, run'
  echo 'isolated PostgreSQL+HTTP+Chromium and delete ONLY the owned temporary stage.'
  echo 'No native end-user installer, cloud model, public release, or deployment.'
  echo 'Use --run-relocated to test moving an intact private deployment to a fresh staging path before Postgres/browser.'
  exit 0
fi
if [ "$#" -ne 1 ] || { [ "$1" != --run ] && [ "$1" != --run-relocated ]; }; then
  echo 'Usage: bash scripts/bostan-private-staged-full-app-acceptance.sh [--plan|--run|--run-relocated]' >&2
  exit 2
fi
MODE="$1"
case "$(uname -s)" in Darwin|Linux) ;; *) echo 'Private staged native acceptance requires macOS/Linux' >&2;exit 2;; esac
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"
for prerequisite in node pnpm initdb pg_ctl createdb curl; do
  command -v "$prerequisite" >/dev/null 2>&1 || { echo "Missing local Bostan QA tool: $prerequisite" >&2; exit 2; }
done
# Verify both the source/build disk and the actual staging disk; Linux
# /tmp may be a separate mount with much less available free space.
STAGE_ROOT="$(node scripts/bostan-private-staged-server-check.mjs --stage-root)"
if [ ! -d "$STAGE_ROOT" ] || [ -L "$STAGE_ROOT" ]; then
  echo 'Bostan staged full-app QA refused: unexpected system temporary root' >&2
  exit 2
fi
for disk in "$ROOT" "$STAGE_ROOT"; do
  free_kib="$(df -Pk "$disk" | awk 'NR==2 {print $4}')"
  if ! [[ "$free_kib" =~ ^[0-9]+$ ]] || [ "$free_kib" -lt 4194304 ]; then
    echo "Bostan staged full-app QA refused: less than 4 GiB free in $disk" >&2
    exit 2
  fi
done
export npm_config_offline=true DO_NOT_TRACK=1 OTEL_SDK_DISABLED=true
unset OPENAI_API_KEY ANTHROPIC_API_KEY OPENROUTER_API_KEY GEMINI_API_KEY GOOGLE_API_KEY XAI_API_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY SENTRY_DSN OTEL_EXPORTER_OTLP_ENDPOINT 2>/dev/null || true
# No separate npm registry/online lifecycle hooks. All workspace builds run
# against the frozen current private checkout; no Rust --release build.
pnpm install --offline --frozen-lockfile --ignore-scripts --filter '@bostan/server...' --filter '@bostan/ui...' --filter '@bostan/skills-catalog...' --reporter=append-only
bash scripts/bostan-private-compiled-server-http-qualification.sh --run
pnpm --filter @bostan/ui build
PAPERCLIP_RELEASE_REUSE_UI_DIST=1 bash scripts/prepare-server-ui-dist.sh

STAGE=''
cleanup(){
  result=$?
  trap - EXIT INT TERM
  if [ -n "$STAGE" ] && [ -d "$STAGE" ] && [ ! -L "$STAGE" ]; then
    case "$STAGE" in "$STAGE_ROOT"/bostan-staged-server-????????)
      rm -rf -- "$STAGE" || echo 'BOSTAN_OWNED_STAGE_CLEANUP_FAILED' >&2;;
      *) echo 'BOSTAN_UNEXPECTED_STAGE_PATH_NOT_DELETED' >&2;;
    esac
  fi
  exit "$result"
}
# Mark temporary path as invocation-owned, never accept a caller supplied path.
STAGE="$(mktemp -d "$STAGE_ROOT/bostan-staged-server-XXXXXXXX")"
trap cleanup EXIT INT TERM
pnpm --filter @bostan/server deploy --prod --offline --ignore-scripts "$STAGE"
node scripts/bostan-private-staged-server-check.mjs --repair-owned-self-link "$STAGE" --source-checkout "$ROOT"
node scripts/bostan-private-staged-server-check.mjs --verify "$STAGE"
test -f "$STAGE/ui-dist/index.html" || { echo 'Bostan private staged UI bundle missing' >&2;exit 1; }
if [ "$MODE" = --run-relocated ]; then
  # Create the destination using the trusted OS temp root; reclaim only the
  # empty directory created by mktemp and move on the same filesystem.
  # The normal EXIT trap follows STAGE so the relocated package is cleaned.
  RELOCATED_STAGE="$(mktemp -d "$STAGE_ROOT/bostan-staged-server-XXXXXXXX")"
  rmdir "$RELOCATED_STAGE"
  ORIGINAL_STAGE="$STAGE"
  mv "$STAGE" "$RELOCATED_STAGE"
  STAGE="$RELOCATED_STAGE"
  test ! -e "$ORIGINAL_STAGE" || { echo 'BOSTAN_STAGE_RELOCATION_ORIGINAL_PATH_STILL_EXISTS' >&2;exit 1; }
  node scripts/bostan-private-staged-server-check.mjs --verify "$STAGE"
  test -f "$STAGE/ui-dist/index.html" || { echo 'BOSTAN_STAGE_RELOCATION_UI_MISSING' >&2;exit 1; }
  echo BOSTAN_PRIVATE_STAGED_RELOCATION_VERIFIED
fi
BOSTAN_STAGE_BROWSER_E2E=1 bash scripts/bostan-local-http-postgres-smoke.sh --run-deployed "$STAGE"
if [ "$MODE" = --run-relocated ]; then echo BOSTAN_PRIVATE_STAGED_RELOCATION_ACCEPTANCE_PASS; fi
echo BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS
