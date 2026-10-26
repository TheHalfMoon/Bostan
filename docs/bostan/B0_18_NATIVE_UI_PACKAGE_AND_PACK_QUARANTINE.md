# B0-18 — Bostan board UI package identity and private packing quarantine

Private Bostan engineering, 26 October 2026. Stacked Draft on B0-17 PR #166. No main merge, public release, package publication, deployment, inherited Actions, paid providers or removal of legally mandatory license attribution.

## Real product identity migration

B0-09 (#35) requires native Bostan identity in all owned packages, UI, CLI commands, documentation and release assets. This wave takes the actual app UI workspace package from its inherited name `@paperclipai/ui` to `@bostan/ui`, rather than merely editing visible labels.

- The `ui/package.json` workspace name, description, homepage, bugs link and repository point to Bostan. All published npm rights remain unclaimed: `private:true` and no `publishConfig`.
- `prepack` and `prepublishOnly` point at `scripts/bostan-release-disabled.mjs`. The former donor `postpack` is removed, preventing unsafe mutations of the package manifest.
- The old `scripts/generate-ui-package-json.mjs`, which overwrote the UI workspace package with a PUBLIC package manifest, now refuses via the same explicit Bostan release guard; an actual process test confirms exit 2 and no artifact.
- Current root product commands `dev:ui`, `dev:mobile`, `storybook` and `build-storybook` use `pnpm --filter @bostan/ui`. Active internal Vite/build/run orchestration, Dockerfile (not a deployment), Storybook/preview CLI examples, current product development documentation, app test setup and release inventory use the new name.
- Inherited donor CI and its third-party repository/ref checks remain DISABLED at GitHub Actions level. They have not been redirected to Bostan; no inherited release job is authorized to execute.
- The private release inventory explicitly admits only the private UI and CLI as non-publishable entries while blocking release list and set-version. All inherited public package CI publication flags remain OFF.
- Archived upstream run receipts, historical benchmark fixtures and original upstream legal facts stay historically accurate. Compatibility protocol identifiers, store keys, technical identifiers and original donor copyright/NOTICE content are not blindly renamed.

## Actual evidence in this source branch

- `pnpm install --lockfile-only --offline --ignore-scripts --frozen-lockfile`: PASS, no lockfile drift.
- Workspace packages re-linked with `pnpm install --prefer-offline --ignore-scripts --frozen-lockfile`: PASS, no lifecycle scripts.
- `pnpm --filter @bostan/ui exec tsc -b`: PASS, full UI TS project.
- `pnpm --filter @bostan/ui build`: PASS, real Vite production assets. Existing >500 kB chunk warning remains.
- Bostan private release guard and product manifest source tests: 18 PASS, 0 FAIL, and actual legacy UI pack-generator subprocess refuses, exit status 2.
- Mac source Node Bostan/release suite: 208 PASS, 0 FAIL, 10 platform/opt-in SKIP (218 total).
- Native Windows source verification, real UI test/canonical Case/runtime app evidence recorded after final-head checks.

## Still-open gaps and no-go

Remaining inherited owned workspace names still include `@paperclipai/server`, `@paperclipai/shared`, `@paperclipai/db`, numerous agent/provider/plugin adapters. Those are future bounded source and compatibility migrations, not yet claimed to be native Bostan. Full installed Windows app, full official server build and test on capable hardware, real model-authored independent signed Case, entire network egress and independent security review are NOT complete. No public release/packaging qualification.
