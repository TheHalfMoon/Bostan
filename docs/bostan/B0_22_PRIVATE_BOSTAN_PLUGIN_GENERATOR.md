# B0-22 — Private Bostan plugin scaffold and verified external local SDK link

Private Bostan development, 26 October 2026. Stacked Draft after B0-21 PR #170. No merge to main, publication, deployment, enabling inherited GitHub Actions, paid model inference, deleting user files or erasing required license/source notices.

## Product identity

The old first-party generator package and its filesystem directory were still named for the upstream product. This change **moves** the actual checkout from `packages/plugins/create-paperclip-plugin` to `packages/plugins/create-bostan-plugin`, with npm workspace identity `@bostan/create-bostan-plugin` and local command `create-bostan-plugin`. Active CLI source imports, TypeScript project includes, Vitest source paths, current scripts, package lock importer, disabled release manifest and generator docs are updated. Generated plugin descriptions, categories, keywords, help copy, and next-step command use Bostan.

The generator package is now `private:true`, does not have a public publishConfig, and its prepack/prepublishOnly scripts explicitly refuse npm packaging using the Bostan release gate. Its disabled entry in the private release inventory is an exact-name allowlist; this does not claim any published registry namespace.

The existing `paperclipPlugin` persisted schema field and the SDK type `PaperclipPluginManifestV1` intentionally remain as compatibility surfaces. They must be migrated separately with versioning, dual-read, rollback and database/SDK compatibility tests, not by replacing user data. Copyright and original source notices remain.

## Fix: make external local scaffolds work with private SDK

Previously an outside-workspace scaffold invoked `pnpm pack` on the private plugin SDK and shared source, produced `.paperclip-sdk` tarballs, and recommended switching to published npm versions. That contradicted Bostan's enforced NO-PUBLISH policy and failed on the release guard.

The new generator **does not invoke pnpm pack at all**. It validates that `--sdk-path` resolves to a local `private:true` `@bostan/plugin-sdk` manifest **before creating the output directory**. Inside the actual Bostan monorepo it uses `workspace:*`; outside the monorepo it uses a relative `link:` to the already checked-out local SDK source. It never snapshots the SDK, creates a release tarball, downloads unpublished Bostan packages or mutates an existing target. The generated README accurately explains that the local checkout must remain available and be built before use.

## Real evidence (source-owned disposable paths only)

- Generator real TypeScript build PASS under `@bostan/create-bostan-plugin`.
- Generator focused native Vitest: **4 PASS, 0 FAIL**: import safety, inside-workspace CLI scaffold, external source-link scaffold, and refusal of a falsely named local SDK before output creation.
- Bostan CLI plugin-init integration: **10 PASS, 0 FAIL**, including new `bostan plugin install` next-step text.
- Frozen lockfile offline verification and no-script workspace relink PASS.
- Direct external synthetic `@bostan/test-external-plugin` generated into a new temporary HOME outside Bostan's checkout; package private, actual `link:` points at local SDK. An offline installation alone failed due uncached public npm metadata for `@rollup/plugin-typescript`; the subsequent free public npm registry installation with all lifecycle scripts disabled succeeded (72 dependencies, no paid service). The generated package then successfully **built** and its own Vitest suite returned **2 PASS, 0 FAIL**. No SDK pack, registry publication or other user's plugin modified.
- Static Bostan ownership/release tests: **21 PASS, 0 FAIL**, source updated after actual test.
- Final Mac, Windows source and native app regression results recorded after running exact head.

## Open and scoped

The linked source dependency is intentionally **not** a distributable plugin package; a future approved Bostan packaging flow must address portable SDK/plugin artifacts, signing and upgrades separately. Internal saved protocol field and name examples require a versioned migration. Other inherited package names, official entire server build, model-written independent governed Case closure, installed Windows application QA, native runner security baseline failures and comprehensive security review remain release NO-GO.

No publication or main-branch changes.

## Follow-up hardening and actual outside-workspace execution

- Bostan developer skill folder renamed from `.agents/skills/paperclip-create-plugin` to `.agents/skills/bostan-create-plugin`; its command examples, CLI fallback (`dist/bin.js`), local SDK link instructions and no-publishing guidance now match actual generator behavior. Current local plugin authoring and development docs no longer recommend `pnpm pack` or tell Bostan maintainers to publish the private SDK. Historical stored manifest `paperclipPlugin` remains as an intentional compatibility key.
- A new source guard checks that the renamed developer skill exists, the former path no longer exists, the docs no longer tell users a private SDK is copied as a tarball, and no upstream public CLI command is offered in the scaffold skill. Five product-package/skill tests PASS.
- External generated `@bostan/test-external-plugin` was installed in a **unique disposable test-only `/private/tmp` directory** with public npm metadata and `--ignore-scripts` (72 free registry dependencies); its actual esbuild bundle completed, and its own Vitest suite returned **2 PASS, 0 FAIL**. Prior attempted `--offline` failed only due missing npm metadata, not a broken Bostan SDK link. No third-party code executed through install lifecycle scripts; no SDK packing or publishing occurred.
- Root Bostan plugin-init CLI Vitest **10 PASS, 0 FAIL**. Bostan CLI `tsc --noEmit` **PASS**. Full native Mac Bostan source + private release inventory **226 PASS, 0 FAIL, 10 SKIP** (236 total) before the extra developer skill guard.
- Source Bostan HTTP/real PostgreSQL clean stop/restart/persisted company/headless Chromium on renamed scaffold source **PASS**, with 0 browser page errors and 0 blocked browser requests. No running Bostan app left by the smoke.
