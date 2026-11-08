# B0-34 — Isolated localhost Chromium first-paint qualification

2026-10-27. Private Draft PR stacked above B0-33. No publication, deployment, release, `main` merge, inherited Actions activation, paid model, external services or real database access.

## Implementation

Added `ui/scripts/bostan-preview-browser-smoke.mjs`. After `pnpm --filter @bostan/ui build`, this executable starts the Vite production preview **only on a dynamically selected `127.0.0.1` loopback port**, opens it in a previously installed Playwright headless Chromium, and checks:

- Frontend responds with HTTP 200 and document title `Bostan`.
- Hydrated browser first paint shows the Bostan product identity, not inherited Paperclip branding.
- No uncaught page JavaScript errors; all off-origin requests are blocked and counted (expect zero).
- The script reports a structured `bostan.browser-first-paint.v1` result with `releaseQualified:false`.
- Both browser and owned preview process are terminated in a `finally` block, and the script does not install browsers or contact remote services.

A small `scripts/bostan-browser-preview-contract.test.mjs` verifies the local-only invariants and safe `--help` behavior. This is deliberately separate from the six-stage source preflight to avoid making installed Chromium a mandatory TypeScript/source check.

## Executed evidence

- `node --test scripts/bostan-browser-preview-contract.test.mjs`: **2/2 PASS**.
- `pnpm --filter @bostan/ui exec node scripts/bostan-preview-browser-smoke.mjs`: **PASS**, HTTP 200, title `Bostan`, first paint `Reconnecting to Bostan`, **zero page exceptions**, **zero outbound network requests**, no preview port left listening afterward.
- Existing production Vite build (`ui/dist`, prior B0-33) was reused without changing bundle semantics.

## Explicit scope limitation

Because **no backend server or database was running**, the observed reconnecting state is expected, not proof that full onboarding or user journeys work. This does **not** replace installed Windows/macOS/Linux end-to-end tests, native Rust build, real PostgreSQL backup/migration/restore, security review, independent live-agent evaluation, or a release approval. These all remain OPEN. **Release NO-GO.**
