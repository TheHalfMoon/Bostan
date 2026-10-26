# B0-20 — Native Bostan MCP servers, commands and private plugin examples

Private Bostan development on 26 October 2026, stacked after Draft PR #168 / B0-19. NO merge to main, publish, deploy, use paid providers, enable inherited GitHub Actions or erase legally required attribution.

## Bostan-owned product identities changed

Six actual local workspace packages now use `@bostan/*` identity:

- `@bostan/mcp-server` — native MCP server handshake `bostan`, command `bostan-mcp-server`.
- `@bostan/kv-demo-mcp-server` — MCP server handshake `bostan-kv-demo`, command `bostan-kv-demo-mcp-server`.
- `@bostan/google-sheets-mcp-server` — MCP server handshake `bostan-google-sheets`, commands `bostan-google-sheets-mcp-server` and `bostan-google-sheets-mcp-http-server`.
- `@bostan/plugin-file-browser-example`, `@bostan/plugin-kitchen-sink-example` and `@bostan/plugin-orchestration-smoke-example` — private Bostan-owned source package names.

Google Sheets remains explicitly a Google service; the Bostan name identifies only the locally owned connector/MCP server. The Bostan server's actual gallery/connection template selects the new `bostan-google-sheets-mcp-server` executable. Product README usage and the KV MCP demo command use the new scoped names and local, unpublished invocation. An inherited `npx` instruction was removed after an actual no-publish local executable lookup failed; users must build and run the checked-out source.

Every renamed package is `private:true`, has no public `publishConfig` and has an explicit Bostan `prepack` and `prepublishOnly` failure path. Three former public MCP entries are explicitly recognized as *disabled private* inventory entries by a narrow exact-name allowlist in `scripts/release-package-map.mjs`. All inherited CI publish entries remain disabled. No claim of ownership or publication on a public npm `@bostan` scope.

Historic `PAPERCLIP_*` authenticated run environment names and `paperclip...` persisted REST/MCP tool keys remain binary compatibility surfaces: do not mechanically rename those until versioned dual-read/one-write migration. Historical copyright, source licenses and donor release notes remain accurate. Plugin SDK's inherited dev-server binary is also a separate unresolved dependency; this wave does not pretend its name has changed.

## Genuine fixes uncovered by real tests

A preexisting MCP create-issue test expected an incomplete request body. The production code already sends `visibility:"open"` and `allowDuplicate:false`, so the test was strengthened to assert those specific contract defaults, *in addition* to all previous status, work mode, priority, assigned agent and depth checks. This does not remove any assertion.

The package's old generic `vitest run` command executed the compiled `dist/tools.test.js` duplicate after build as well as `src/tools.test.ts`; Bostan's three MCP package scripts now explicitly run tests from `src` only. Previously observed duplicate failures had identical expected-vs-actual errors.

## Measured qualification in the branch

- All three real TypeScript MCP package builds: **PASS**.
- Source MCP server contract tests: **14 PASS**, including full issue request defaults.
- KV demo store/tools and localhost HTTP tests: **12 PASS**.
- Google Sheets config, mocked client, tools and HTTP tests: **27 PASS** without live Google credentials.
- Server Google Sheets gallery canonical source tests: **3 PASS**, no failures.
- Mac Bostan Node source and private release inventory: **217 PASS, 0 FAIL, 10 SKIP** (227 total).
- B0-20 exact private owned package tests including 6 names, 4 CLI bins, server product handshakes, release quarantine and preset: **9 PASS**.
- Final native Windows source and actual local Bostan persistence + Chromium results added after exact-head verification.
- Three example plugin builds may be separately qualified but are not counted until their build reports PASS.

## Open limits and NO-GO

This is six packages, not completion of all owned package identity (shared, DB, runner, adapter-utils, provider adapters and SDK still need guarded migration). User data/provider protocol identifiers, installed-package migration, whole-app Windows installer, full official server TypeScript build on adequate host, actual model-authored independent governed Case closure and comprehensive network/security review are not qualified. Runner has two independently reproduced existing Mac node-module ancestor-resolution tests failing on the B0-18 parent baseline. Release **NO-GO**. No publication.

## Exact final package build boundary and compatibility proof

- Actual three Bostan MCP package TypeScript builds PASS (after advertised MCP server name migration). No live Google credentials or external service were used.
- Two pnpm-included sample plugins `@bostan/plugin-file-browser-example` and `@bostan/plugin-kitchen-sink-example`: real TypeScript / UI bundle builds PASS.
- `@bostan/plugin-orchestration-smoke-example` is intentionally excluded in `pnpm-workspace.yaml`. Its filtered pnpm build prints `No projects matched` with exit 0; do **not** treat that as a build pass. A direct build explicitly FAILS because the excluded fixture has no installed `@paperclipai/plugin-sdk` in its own node_modules. Its source metadata has been renamed but **its independent build is not qualified**, pending separately scoped dependency/link setup; do not mutate workspace lockfile blindly.
- All three MCP source test suites PASS: 14/14 API, 12/12 KV (including ephemeral localhost HTTP), 27/27 Google Sheets (mocked service). Total **53 PASS, 0 FAIL**.
- `server/src/__tests__/google-sheets-gallery.test.ts` 3/3 PASS on the renamed local binary and original compatibility gallery template.
- Synthetic source Bostan + PostgreSQL clean stop/restart + persisted company + real headless Chromium PASS. Browser page errors 0, blocked external requests 0.
- Source Mac Bostan Node tests and release inventory: 217 PASS, 0 FAIL, 10 SKIP (227 total) prior to final package advertisement test addition.
- Private package identity + runtime command + release guard: 9 PASS, 0 FAIL. Old `paperclip...` user-data/API tool identifiers remain documented compatibility keys and are not claimed to be migrated.
