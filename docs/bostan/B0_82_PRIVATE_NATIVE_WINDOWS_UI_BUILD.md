# B0-82 — Native Windows 11 private Bostan frontend qualification

**2026-10-28**. Private stacked Draft over B0-81 PR #230 (`72cb8894a74acfc4cda91414921e6530948e6511`). GitHub repository PRIVATE, GitHub Actions disabled, no `main` merge, paid model calls, public release or customer data.

## Why this matters

B0-60 already qualified native Windows Node CLI negative installation/file-safety tests (13 passes and 13 skips), but did **not** build or typecheck the real production UI on Windows. B0-75 through B0-77 qualified a real production compiled app + PostgreSQL + Chromium browser on native Linux ext4. Neither result proves that the Windows 11 native Vite/Rolldown and TypeScript toolchain can build the end-user frontend.

## New fail-closed reusable gate

`scripts/bostan-private-windows-ui-qualification.mjs` is **read-only by default**: no arguments or `--plan` describe the scope. Explicit `--run` is accepted **only on native Windows Node >=24**, with exact private `bostan` and `@bostan/ui` manifests, both registry-release deny hooks intact, at least 3 GiB physical free on the checkout volume and no inherited upstream Cloud environment signals. The child process strips provider credentials and telemetry exporters and uses offline npm mode; it executes only:

1. Validate **runner source-only transitive compile dependencies** `ajv/dist/2020.js`, `json-schema-to-ts`; reject missing scoped-install prerequisites (no network or silent repo mutation).
2. `pnpm --filter @bostan/plugin-sdk build` — builds the actual plugin SDK UI export and shared dependency; `--ignore-scripts` intentionally does not compile it on install.
3. `pnpm --filter @bostan/ui typecheck` — generates Storybook catalog and runs actual TypeScript build.
4. `pnpm --filter @bostan/ui build` — actual production Vite/Rolldown frontend build.

After success it verifies that the realpath of `ui/dist` remains inside the checkout, that `index.html` identifies **Bostan**, and that JS and CSS bundles exist. Does **not** run a provider, a database, an installer, a registry publish or a server.

## Verification

- Mac ARM64 Node26: new safety/default-inert/negative tests **3/3 PASS**, plus B0-81 root-command tests **3/3 PASS**. `node --check` and `git diff --check` passed.
- Windows 11 `Abdulaziz`: native Node24.19/pnpm9.12, checkout at the B0-82 source head, frozen-ignore-scripts install of `@bostan/ui...` and `@bostan/runner...` using D: temp/store, **PASS**. Explicit `--run` gate **exit 0**, genuine TypeScript/SDK and Vite Windows output audited. Full record below.
- Both failures and final pass are documented transparently below; no Linux/WSL substitution was used and no TypeScript tests were skipped. Vite warnings did not count as failures after correcting the PowerShell wrapper.

## Open work

The Windows UI build gate is **not** a complete native Windows installed app, actual local PostgreSQL+authenticated HTTP/Chromium on Windows, signed installer or a successful free-model agent. Those and third-party dependency license/security audit remain OPEN. No publication permitted.

### Initial native Windows failure and required repair

The initial frozen **UI-only** scoped install completed **902/902 packages** in 4m 10s but intentionally skipped package build scripts. The first actual native Windows UI typecheck **FAILED exit 1**, not a pass: `@bostan/runner` source imports could not resolve `ajv/dist/2020.js` or `json-schema-to-ts`; the UI could not resolve `@bostan/plugin-sdk/ui` because the SDK's `dist/ui` had not been built. These were incomplete QA build prerequisites, not verified application source defects. B0-82 now preflights runner dependency presence and explicitly builds the SDK before typecheck. The Windows QA runner store is being augmented with the pinned runner dependency closure; **record the actual retake output before calling Windows qualified**.


### Real cross-platform build blocker and fix

After completing the second, **frozen-lockfile + ignore-scripts** install with the required `@bostan/runner...` closure (17 selected workspaces; 16 extra packages, Windows exit 0), the native Windows gate correctly advanced to `@bostan/plugin-sdk build` but **failed exit 1** because `@bostan/shared` runs `tsc && mkdir -p ... && cp ...`, which depends on Unix shell commands absent from native Windows Command Prompt. No application typecheck/build PASS was claimed for that retake.

Repaired the **real first-party cross-platform product build script** in `packages/shared/package.json` to `tsc && node scripts/copy-cliplab-notices.mjs`. The new standard Node API utility copies both original required `LICENSE` and `PROVENANCE.md` byte-for-byte from the owned package into `dist/cliplab`, checks output realpaths, and refuses symlinked output directories/files or missing/foreign source notices. It never removes/relicenses/rewrites copyright or provenance material. Mac safety tests **3/3 PASS** including idempotent repeat, missing source notice refusal, and symlink escape denial; Windows gate source tests **3/3 PASS**. **Only a real Windows rerun can qualify the build.**


## **Final native Windows third retake — qualified scoped PASS**

On Windows 11 `Abdulaziz`, Node **24.19.0**, pnpm **9.12.0**:
1. Frozen-lockfile, `--ignore-scripts` scoped `@bostan/ui...` install **902/902 packages, exit 0**. Then broadened to actual `@bostan/runner...` closure: **16 additional packages, exit 0**. Both stores and TEMP were on **D:**. All downloads used the public npm registry; no private registry publish or paid provider.
2. Source/safety tests in native Windows PowerShell: **6/6 PASS** (3 CLI gate, 3 legal copying tests; the POSIX symlink-escape test returns early on Windows because creating symlinks may require privileges; actual symlink-negative PASS independently on Mac).
3. First real UI run failed from missing Runner dependencies and missing compiled plugin-sdk UI export, described above. The second retake passed SDK preflight but the shared package build failed because its old `mkdir -p` and `cp` commands were POSIX-only. The source build script was repaired portably, retaining original copyright notices byte-identically.
4. Third retake on the corrected source (same Windows checkout, actual pnpm script) passed **`BOSTAN_SHARED_CLIPLAB_NOTICES_VERIFIED`**, **`BOSTAN_WINDOWS_PRIVATE_PLUGIN_SDK_BUILT`**, **`BOSTAN_WINDOWS_PRIVATE_UI_TYPECHECK_PASS`**. The initial PowerShell 5.1 wrapper treated a Vite **warning** written to stderr as a terminating PowerShell `NativeCommandError`; that wrapper ended **exit 1** without valid Vite result. This is **not** a Vite failure. Re-ran the *same code* in native **`cmd.exe`**, capturing stdout+stderr to a logfile and checking the actual process exit.
5. **Final exact native Windows Vite production build passed**, **`BOSTAN_WINDOWS_PRIVATE_UI_BUILD_PASS`**; actual bundle check **`BOSTAN_WINDOWS_PRIVATE_UI_ASSETS_VERIFIED`** found **516 JS assets**, **3 CSS assets** and a Bostan-branded `ui/dist/index.html`. Terminal marker **`B082_NATIVE_WINDOWS_CMD_RETAKE_EXIT=0`**, runtime ~105 seconds. **0** provider calls, no actual database, no installer, no registry actions. Some non-blocking CSS pseudo-element and large-chunk warnings remain.

**Disposition:** B0-82 native Windows compiled **frontend TypeScript + Vite build** is scoped **PASS**. UI browser/installer, native Windows server+PostgreSQL and real free-model agent are still **NOT QUALIFIED**; overall release **NO-GO**.
