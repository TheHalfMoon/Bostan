# B0-23 — Private Bostan first-party plugin package catalog

Private Bostan engineering, 26 October 2026. Draft stacked on B0-22 PR #171. No publication, merge to main, deployment, paid models, inherited Actions, user data cleanup, or deletion of required donor attribution.

## Native Bostan package names and paths

The following five first-party plugins now carry local `@bostan/*` workspace package identities:

- `@bostan/plugin-hello-world-example`
- `@bostan/plugin-authoring-smoke-example`
- `@bostan/plugin-llm-wiki`
- `@bostan/plugin-workspace-diff`
- `@bostan/plugin-fake-sandbox`

The source directory `packages/plugins/paperclip-plugin-fake-sandbox` has moved to `packages/plugins/bostan-plugin-fake-sandbox`; actual Dockerfile COPY path and pnpm lockfile importer are updated. Existing Bostan server gallery/registered package list and source UI test fixtures reference the new package identities. This is source product branding, not a claim that any third-party plugin or public npm scope belongs to Bostan.

All five are now `private:true`, have no `publishConfig`, and their `prepack` and `prepublishOnly` scripts explicitly refuse publishing via `scripts/bostan-release-disabled.mjs`. The inherited mutating `postpack` in workspace-diff was removed. Its entry in the private release inventory is explicitly disabled, with exact-name checking. Package repository metadata points at the correct `TheHalfMoon/Bostan` repository.

The `paperclipPlugin` manifest field, SDK `PaperclipPlugin*` types, historical test fixture IDs and original author/copyright/license/source-provenance notices remain compatibility/legal facts; they are not rewritten blindly. The next migration of stored keys must use versioned dual-read, controlled write and rollback tests.

## Real functional issue found in LLM Wiki tests

The Wiki package renders React directly in its Vitest suites but did not declare React as its own development dependency. On a clean/strictly isolated pnpm workspace this caused two test files to fail during module import even while building the plugin succeeded. Added `react:^19.2.8` as a **devDependency only**, preserving `peerDependencies.react: >=18`, with no runtime `dependencies` or duplicate React bundle. Its test now asserts this test-only development dependency and preserves the runtime peer guard. The actual shared Bostan Plugin SDK esbuild bundler preset declares `react` and `react-dom` external.

An offline-only lockfile regeneration initially lacked unrelated cached public metadata for `@types/node`; normal free npm metadata resolution completed without lifecycle scripts, followed by a frozen no-script workspace relink. No Bostan package was published or downloaded.

## Measured tests

- All five actual first-party plugin TypeScript/bundler builds PASS.
- Wiki: **101 PASS, 0 FAIL** after the direct devDependency fix.
- Workspace Diff: **26 PASS, 0 FAIL**.
- Fake Sandbox: **6 PASS, 0 FAIL**.
- Authoring smoke: **2 PASS, 0 FAIL**.
- Total dedicated plugin tests: **135 PASS, 0 FAIL**. Hello World has an actual build but no independent package test.
- Two canonical server plugin API suites backed by real test database/API: **82 PASS, 0 FAIL**, including bundled package names and authz.
- Bostan UI Plugin Settings: **6 PASS, 0 FAIL**.
- Eight new Bostan private package / disabled release / moved path / preserved protocol tests PASS.
- Native Mac Bostan Node source and guarded private release suite: **235 PASS, 0 FAIL, 10 SKIP (245 total)** on B0-23 code before the evidence-only docs commit.
- Native Windows and actual local browser results follow after final branch checks.

## Remaining NO-GO gates

Some other first-party packages and internal runtime wire IDs still carry historical donor names; these require controlled migrations, not blind source replacement. Installed Windows app E2E, complete official server build on suitable RAM/disk, independently model-authored and signed governed Case terminal completion, whole-host egress inventory and independent security review are NOT qualified. Existing inherited ACPX runner security failures remain open. No release authorized.

## Final local app and package tests after React dependency correction

- Local Bostan HTTP app, real PostgreSQL persisted synthetic company, clean stop/restart, headless Chromium private UI: PASS, **0 browser page errors, 0 blocked browser external requests**; own processes cleanly stopped.
- Two canonical source/server plugin API suites with native real database: **82 PASS, 0 FAIL**, including authz and bundled package listing under the new Bostan names.
- Bostan plugin-settings UI source: **6 PASS, 0 FAIL**.
- All five renamed plugins built; Wiki 101 PASS, Workspace Diff 26 PASS, Fake Sandbox 6 PASS, Authoring Smoke 2 PASS. Combined package tests **135 PASS, 0 FAIL**.
- Five renamed packages removed from inherited workspace identity; **26 other @paperclipai/ package manifest names** still remain and B0-09 full identity is therefore OPEN.
- No source React runtime dependency was added to Wiki. Only a devDependency for local tests; the SDK's documented esbuild bundler treats React and React DOM as external, preserving host React peer semantics.
