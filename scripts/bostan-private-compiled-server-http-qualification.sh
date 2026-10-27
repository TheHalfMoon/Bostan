#!/usr/bin/env bash
# Bostan private source-only qualification. Do not publish or install anything.
set -euo pipefail
if [ "${1:-}" = '--plan' ] && [ "$#" -eq 1 ]; then
  echo 'Bostan private compiled-server HTTP QA: offline source JS build, isolated Postgres and /api/health; no models or publishing.'
  echo 'Prerequisites: offline installed pnpm deps; local PostgreSQL CLI; valid Bostan checkout; >=2 GiB free space.'
  echo 'Run explicitly with: bash scripts/bostan-private-compiled-server-http-qualification.sh --run'
  echo 'Excluded: native Rust release build, end-user installer, browser release and real-model qualification.'
  exit 0
fi
if [ "$#" -ne 1 ] || [ "$1" != '--run' ]; then
  echo 'Usage: bash scripts/bostan-private-compiled-server-http-qualification.sh [--plan|--run]' >&2
  exit 2
fi
case "$(uname -s)" in Darwin|Linux) ;; *) echo 'Bostan built server QA requires macOS/Linux source checkout' >&2;exit 2;; esac
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"
# This task can exhaust an 8 GiB Mac if full production Rust or a full TS
# noEmit check runs: never invoke either here. Require conservative free space.
free_kib="$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')"
if ! [[ "$free_kib" =~ ^[0-9]+$ ]] || [ "$free_kib" -lt 2097152 ]; then
  echo 'Bostan private compiled-server QA refused: insufficient safe disk headroom' >&2
  exit 2
fi
for required in node pnpm initdb pg_ctl createdb curl; do
  if ! command -v "$required" >/dev/null 2>&1;then echo "Bostan compiled-server QA prerequisite missing: $required" >&2;exit 2;fi
done
export DO_NOT_TRACK=1 OTEL_SDK_DISABLED=true BOSTAN_FEEDBACK_EXPORT_ENABLED=0
export npm_config_offline=true
unset OPENAI_API_KEY ANTHROPIC_API_KEY OPENROUTER_API_KEY GEMINI_API_KEY GOOGLE_API_KEY XAI_API_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY OTEL_EXPORTER_OTLP_ENDPOINT SENTRY_DSN 2>/dev/null || true
# Private staged JavaScript compilation only. Running server's production
# build invokes a separate Rust release build and is intentionally excluded.
pnpm --filter @bostan/plugin-sdk build
pnpm --filter @bostan/runner build:typescript
pnpm --filter @bostan/db exec tsc --noCheck
for pkg in \
  @bostan/adapter-utils @bostan/adapter-claude-local @bostan/adapter-codex-local \
  @bostan/adapter-cursor-cloud @bostan/adapter-cursor-local \
  @bostan/adapter-gemini-local @bostan/adapter-grok-local @bostan/adapter-hermes \
  @bostan/adapter-kimi-local @bostan/adapter-openclaw-gateway \
  @bostan/adapter-opencode-local @bostan/adapter-pi-local @bostan/skills-catalog; do
  pnpm --filter "$pkg" exec tsc --noCheck
done
pnpm --filter @bostan/server exec tsc --noCheck
node server/scripts/verify-runner-vendor-dependencies.mjs
mkdir -p packages/db/dist/migrations/meta packages/adapters/codex-local/dist/server
cp packages/db/src/migrations/*.sql packages/db/dist/migrations/
cp packages/db/src/migrations/meta/_journal.json packages/db/dist/migrations/meta/
cp packages/adapters/codex-local/src/server/codex-auth-merge-decision.cjs \
  packages/adapters/codex-local/src/server/codex-auth-merge-extract.sh packages/adapters/codex-local/dist/server/
mkdir -p server/dist/onboarding-assets server/dist/built-ins server/dist/services/scripts server/dist/vendor/paperclip-runner
cp -R server/src/onboarding-assets/. server/dist/onboarding-assets/
cp -R server/src/built-ins/. server/dist/built-ins/
cp -R server/src/services/scripts/. server/dist/services/scripts/
cp -Rf packages/paperclip-runner/dist/. server/dist/vendor/paperclip-runner/
node server/scripts/write-build-stamp.mjs
# Reuse established disposable db + loopback HTTP acceptance, not a test stub.
bash scripts/bostan-local-http-postgres-smoke.sh --run-dist
echo BOSTAN_PRIVATE_COMPILED_SERVER_HTTP_ACCEPTANCE_PASS
