# B0-25 — First-run identity, assistant consent and offline recovery

**Status: private source/UI copy remediation. Consumer UI build and browser
E2E remain NOT QUALIFIED. Release NO-GO.**

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
- Changes to TSX paired test expectations are source-only here; full Vite
  UI build, Vitest in-browser/React assertions, actual browser screenshots,
  device startup and real user acceptance have **NOT** been run in this
  fresh checkout. Do not treat static checks as a substitute.
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
ui/public/sw.js` and `git diff --check` both passed. No pnpm/Vite UI build or
React browser tests were run in this clean Mac checkout.
