# B0-25 — First-run identity, assistant consent and offline recovery

**Status: private source/UI copy remediation. Mac UI production bundle and
focused React tests pass. Consumer installer and browser E2E remain NOT
QUALIFIED. Release NO-GO.**

## Scope

- Replace inherited user-visible product copy in first-admin onboarding,
  invitations, browser error and reconnection states, CLI authorization,
  assistant MCP consent and the assistant connection landing view.
- Replace the inherited Paperclip icon in the two assistant-connection
  entry points with a neutral Sprout glyph. The final Bostan graphic identity
  is a separate design task; this is not a logo approval.
- Remove inherited source-site outbound URL from the demonstration-only
  announcement. Keep a synthetic example.org URL in the announcement test
  fixture to preserve test coverage of external-link safety.
- Replace the source project's offline-page mascot SVG and visible name with
  a dependency-free, text-only Bostan mark and an accessible retry control.
  Use a Bostan-specific public-asset cache namespace. Retain the existing
  fail-closed worker fetch/no-store behavior and the build-time placeholder
  tokens; they are internal compatibility contracts.
- Update corresponding UI test expectations. Do **not** rename the
  `paperclip:*` authorization scopes, inherited private workspace package
  imports, server route names, or database IDs. These require deliberate
  compatible migrations rather than string replacement.

## Verification and limitations

- Node's independent source/worker contract test verifies selected front-door
  copy, retained MCP scope strings, no inherited illustration, HTTP 503
  `no-store` offline response, no remote scripts/assets and no intercepted
  authenticated API request. It executes the real service worker JavaScript
  in a synthetic isolated VM and invokes the real fetch listener.
- `node --check ui/public/sw.js` and `git diff --check` must pass.
- The Mac Vite production bundle, TypeScript project check and a focused
  React/Vitest suite now pass after offline-only workspace dependency setup.
  This is **not** a consumer installer or a live backend/browser E2E.
  Actual browser screenshots, device startup, cross-platform installation
  and end-user acceptance remain **NOT RUN**.
- This is only the first-run subset. Hundreds of source UI files still
  contain inherited wording or internal compatibility names. No claim of
  a completed project-wide rebrand or release-ready product is made.

Stacked private Draft on B0-24. Do not merge, publish, deploy, release,
enable Actions, access paid providers, or write into non-disposable data.

## Local evidence — macOS, October 24, 2026

`node --test scripts/bostan-*.test.mjs cli/src/__tests__/bostan-preview.test.mjs`:
**80 PASS, 0 FAIL, 9 Windows-only SKIP**. The four B0-25 standalone tests
passed, including execution of the real synthetic service worker fallback
and refusal to intercept an `/api/companies` request. `node --check
ui/public/sw.js` and `git diff --check` both passed. The UI qualification below supersedes the earlier source-only limit.

## Native workspace frontend qualification — same Mac checkout

Used **pnpm offline and the existing local package store** (zero packages
downloaded in the first scoped install, no paid provider). Built shared and
plugin SDK dependencies locally, generated the Storybook catalog, then ran:

- `vitest run` focused API, service-worker, build-id and privacy tests:
  **58 PASS / 0 FAIL**, including 22 worker privacy tests.
- `vitest run` App, CloudAccessGate, AppErrorBoundary, announcement and
  Vite component-name tests: **49 PASS / 0 FAIL**. Four initial failures
  exposed mismatched actual bootstrap headings and a two-link assumption
  in the preview announcement; these were corrected and the full targeted
  group rerun passed. Total **107/107 focused Vitest PASS**.
- `pnpm --filter @paperclipai/ui exec tsc -b --pretty false`:
  **PASS** after installing missing runner dependencies, building plugin
  SDK and generating Storybook artifacts locally.
- `CI=1 pnpm --filter @paperclipai/ui build`: **PASS**, 2.89 seconds on
  the final source; generated `ui/dist/index.html` and stamped `sw.js`.
  Validated the stamped worker has no unexpanded placeholders, contains
  the Bostan offline heading, and parses with `node --check`.
- `git diff --check`: **PASS**.

The UI bundle reports inherited large-chunk warnings; performance work
remains. Bootstrap's runnable fallback still uses the inherited
`npx paperclipai auth bootstrap-ceo` source command while Bostan CLI full
bootstrap/installer migration remains unqualified. This operational
compatibility command must be migrated with functionality and regression
tests; it was **not** deceptively renamed to a nonworking command. The
underlying MCP `paperclip:*` scope names similarly remain unchanged for
compatibility. No real HTTP server, database, Windows acceptance harness,
visual browser E2E, release gate or production workload was qualified.
