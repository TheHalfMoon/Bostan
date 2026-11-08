# B0-21 — Private Bostan plugin SDK package and local developer command

Private Bostan engineering, 26 October 2026. Stacked Draft after PR #169 / B0-20. Do not merge into main, publish or deploy, enable inherited GitHub Actions, run paid services or erase required upstream LICENSE, NOTICE, provenance records or test evidence.

## Concrete product identity migration

The core plugin SDK formerly declared `@paperclipai/plugin-sdk` while the app command, server, UI, catalog, MCP packages and selected sample plugins already identified as Bostan. This wave moves the **actual shared development SDK package** to `@bostan/plugin-sdk`. It updates about 203 active tracked files and 8 developer-command references, including package dependents, source imports, plugin build helpers, CLI generated sample dependencies, UI plugin bridge, server plugins, root build/test commands, workspace pnpm importer references, current developer docs and source CI selectors.

The SDK's locally owned command is now `bostan-plugin-dev-server`, replacing the old developer binary in the manifest, example scripts, template output and active instructions. Product developer documentation no longer says an unpublished private `@bostan/plugin-sdk` can be installed from public npm; instead use the checked-out source/workspace build. The plugin SDK and dependent Bostan first-party packages are not claimed to own a public npm namespace.

The SDK is now `private:true`, its public publishConfig was removed, its repository/homepage/bug links point at `TheHalfMoon/Bostan`, and it has explicit fail-closed `prepack` and `prepublishOnly` scripts. The private release manifest accepts this exact, *disabled* Bostan-owned SDK entry; inherited publication list generation remains blocked and GitHub Actions disabled.

## Compatibility and original legal attribution

Historical `paperclipPlugin` persisted manifest field names, shared API classes named `PaperclipPlugin...`, wire protocol/tool/environment identities, required legal notices and genuine original source provenance remain intact. A future migration must provide dual-read/controlled write, tests and rollback before changing stored identifiers; package identity alone must not corrupt existing plugins. The standalone create-plugin scaffold **itself** is not yet renamed; its dependency on SDK and generated imports do now use `@bostan/plugin-sdk` and `bostan-plugin-dev-server`.

Historical upstream release notes and archived documents were not rewritten into false Bostan release claims. Donor-owned CI safety gates were not reenabled.

## Evidence

- The new SDK package and dependent app/example source dependencies are correctly symlinked through the pnpm workspace to `@bostan/plugin-sdk`; no active `@paperclipai/plugin-sdk` import or `paperclip-plugin-dev-server` command was found in the primary code/test/script roots.
- Frozen lockfile check and no-lifecycle-script workspace dependency relinking PASS without third-party version drift.
- `pnpm --filter @bostan/plugin-sdk build`: PASS (SDK and existing shared dependency compile). The remaining `@paperclipai/shared` is an honest not-yet-migrated package.
- SDK protocol and idle-drain native Vitest: **28 PASS, 0 FAIL**.
- Existing scaffold generated plugin entrypoint tests under its current inherited package name: **2 PASS, 0 FAIL**, now importing the new SDK.
- File-browser and kitchen-sink Bostan plugin example builds PASS; the supplied third `@bostan/plugin-hello-world-example` build command matched no workspace project because that package has not yet been renamed. Do **not** claim its build qualified.
- Four new checks for Bostan SDK ownership, binary, source release guard, active consumers, intentionally preserved protocol metadata and disabled release inventory PASS.
- Mac existing Bostan Node + private release inventory 218 PASS / 0 FAIL / 10 SKIP (228 total) before the new four SDK identity checks.
- UI TypeScript project under `@bostan/ui`: PASS.
- `node scripts/release-package-map.mjs check`: PASS; explicit packaging refusal exits nonzero as expected.
- Additional exact-head app/Case, source and Windows evidence appended after results.

## Open blockers

This is **one foundational package migration**, not all-product completion. DB, shared, adapters, runner, plugin scaffold and many other first-party package names remain inherited. All releases remain NO-GO pending complete installed Windows app, full official server build on a resource-adequate host, independently model-authored final governed Case, full network isolation/security audit and repair of two independently reproduced baseline runner-security test failures. No deployment or release authorized.

## Final Mac source and application qualification before PR

- Mac native Node source and guarded release map: **222 PASS, 0 FAIL, 10 SKIP (232 total)** on B0-21 source.
- Existing five canonical governed Case/independent verification/HTTP/PostgreSQL integration suites: **22 PASS, 0 FAIL**.
- Actual Bostan HTTP server with real local PostgreSQL, synthetic persisted company, clean stop, restart, persisted readback, private Chromium: PASS; **zero page errors, zero blocked browser external requests**, and clean shutdown.
- SDK build PASS, SDK core 28 PASS, current scaffold entrypoints 2 PASS, workspace file-browser and kitchen-sink plugin builds PASS.
- The old inherited-name Hello World package has **not** been qualified by a `@bostan/plugin-hello-world-example` filter; that filter returns no matching projects. This is remaining Bostan identity work.
- Full native Mac production server TypeScript build still cannot be claimed; case and UI checks do not replace it.

## Exact native Windows qualification and private PR

- Windows `Abdulaziz` source Node and release guards on B0-21 code: **224 PASS, 0 FAIL, 8 platform/opt-in SKIP (232 total)**.
- Mac source Node and release guards: **222 PASS, 0 FAIL, 10 platform/opt-in SKIP (232 total)**.
- Windows full installed app, private browser, actual model-runner and official production server compile were **not** tested: this is source-only due Windows free RAM/disk restrictions. Three preexisting B023 untracked QA scripts were preserved; no device cleanup was performed.
- Private Draft PR #170 is stacked after PR #169; no changes to main or release state.
