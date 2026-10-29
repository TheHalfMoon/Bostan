# B1-36 — Native Mac full compiled-server smoke and Windows Runner ESM import repair

Date: 2026-10-29. Repository **TheHalfMoon/Bostan**, PRIVATE, strictly NONPUBLISHING. Exact base B1-35 Draft PR #288 head `87e4713b2aa609045a7c912d31f5dc53ba6e1d9a`. No protected-main merge, GitHub Actions activation, deployment, release, npm pack or paid compute.

## Real Mac evidence (not synthetic tests)

Authorized Mac Desktop Commander machine (macOS arm64; **Node v26.0.0**). Cloned the exact private B1-35 head into an **isolated** `~/Bostan-B135-qa` checkout; no other project checkout or user files were modified. Initial usable disk ~24 GiB and free memory ~46%, with no Bostan checkout previously at the tested search depth. Native regression suite:
- 49/49 PASS, 0 FAIL, 0 SKIP, after normalizing a **test fixture**'s `os.tmpdir()` through `realpath` to avoid macOS' symlinked `/var` ancestor. Production SHA-256 admission was not weakened.
- `pnpm --filter '@bostan/server...' install --offline --frozen-lockfile --ignore-scripts` first failed because the cache lacked public `@1password/sdk@0.5.0`. Retried through free public npm (with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`, `--frozen-lockfile`, `--ignore-scripts`, constrained network concurrency): installed **805 packages** successfully, exit 0. Lockfile unchanged; executable link warnings refer to packages that had not yet been built.
- Pinned **esbuild 0.28.2** and TypeScript **7.0.2** verified. `pnpm --filter @bostan/plugin-sdk build` and exact copied legal `LICENSE` and `PROVENANCE.md` verification PASS.
- `pnpm --filter @bostan/server build` **exit 0**, actual Rust release compile and TS build complete, portable assets and local Copilot runtime assets generated; `server/dist/index.js` and build stamp written. Rust generated a few nonfatal unused-code warnings; the first Runner build indicated its input digest changed during that build, so do not claim that first stamp reproducible.
- Initial `pnpm --filter @bostan/server build:runtime` **FAILED** with 871 real esbuild unresolved imports: workspace packages such as `@bostan/db` and `@bostan/adapter-utils` had not yet been compiled. This was a build-order dependency, not a server runtime error.
- Built all **18 transitive workspace dependencies** in topological order: `pnpm -r --workspace-concurrency=2 --filter '@bostan/server^...' run build`, **exit 0**. The Runner build successfully recorded `paperclip.runner-build-inputs.v2` rather than the previous no-stamp warning. No source package identities or licenses changed.
- Retried `pnpm --filter @bostan/server build:runtime`: **exit 0**. Real pinned esbuild took **2366 module inputs -> 119 chunks in 5224ms**, created `server/dist-runtime/index.mjs` and `.bostan-compiled-runtime-owner.json`.
- Independently called production `assertSafeRuntimeOutdir(server/dist/index.js, server/dist-runtime)`: **PASS**; SHA-256-verified **238 generated files**, required `index.mjs` and `server.mjs` present. `git status --porcelain` showed no tracked/untracked source changes from build.
- Real compiled server boot: `SMOKE_TIMEOUT_SECONDS=180 bash scripts/server-boot-smoke.sh node server/dist-runtime/index.mjs` **exit 0**. Logged: `boot smoke ok: listening after 14309 ms, ready after 14367 ms`. Local `127.0.0.1` HTTP health returned ready, its own child stopped, subsequent read-only scan found no lingering command-line `server/dist-runtime/index.mjs` process. This proves real compiled-server boot and HTTP health on macOS, **not authenticated 18-stage PG/BetterAuth, Chromium or offline agents**.
- After build free disk was ~19 GiB. No user files or unowned processes killed.

## Native Windows ESM loader defect reproduced and repaired

Authorized Windows Abdulaziz, native **Node v24.19.0**, test checkout `D:\Bostan-B135-qa` with its clean source from B1-35. Existing B1-35 native OS tests: **46/49 PASS, 0 FAIL, 3 SKIP** solely for unavailable file symlink permission (native directory-junction rejection PASS). Scoped offline pnpm install subsequently **SUCCESS** from pre-existing cache: **803 packages**, `INSTALL_EXIT=0`, available RAM ~3.7 GiB/D ~13.46 GiB. No network packages paid for.

Two initial full transitive dependency builds reproducibly failed with Node `ERR_UNSUPPORTED_ESM_URL_SCHEME` (protocol `d:`). Individual protocol-coverage, semantic contract and stress traceability probes identified the **actual** failing command: `node scripts/check-runner-workflow-traceability.mjs`. Source `packages/paperclip-runner/scripts/check-runner-workflow-traceability.mjs` used `await import(resolve(packageRoot, "dist/eval/index.js"))`, passing an absolute Windows path into Node's ESM loader. It was not a memory problem or a reason to increase a timeout. The pre-fix stand-alone command reproduced the same error; previous `generate-protocol-coverage` and `generate-semantic-contracts` commands succeeded when run separately.

B1-36 adds `runnerStressEvalModuleUrl(packageRoot)` using Node `pathToFileURL(...).href` and changes that single dynamic import to use the valid file URL. Adds independent Node tests with real temporary `dist/eval/index.js` modules, including a path containing spaces. **Exact GitHub B1-36 commit** `14a600aa34a504a697ba87b7105011009428278f` was checked out independently on Windows and Mac:
- Windows: new **2/2 PASS**, then **real Runner stress traceability check EXIT 0**, logged `44 findings, 12 workflows, 1 explicit exclusion`.
- Mac: new **2/2 PASS**, then the **same real Runner check EXIT 0**, same 44/12/1 proof.
- No change to Runner's manifests, source catalogs, security policy or generated output inventories.

A further full Windows dependency build began from this exact B1-36 head with `CARGO_BUILD_JOBS=2` and a free-RAM/disk preflight; the verified next stage passed the formerly failing check and proceeded to fetching Windows Rust dependencies. **Do not claim full Windows build success without a completed exit-0 receipt.**

## Remaining product gates / release decision

The user requested no human reviewers; automated tests are the acceptance standard. Despite actual Mac full runtime compilation and boot, **issue #237** requires the full **native Windows** pinned compiled server, real embedded PostgreSQL, BetterAuth cookie/login, authenticated/private 18-stage HTTP, admin bootstrap/tenant isolation. **Issue #234** requires broad multi-suite PostgreSQL orphan-process proof. Real local no-cost agent task, Chromium/Playwright, installers, full security/privacy/provenance/license and Windows/macOS/Linux user journeys still need objective evidence. Release remains **NO-GO**.

This work stays in a PRIVATE stacked Draft PR, never protected-main merge, publish, release, deploy, npm pack, activate Actions, use paid AI/cloud models or real customer data.
