# B0-24 — Native private Bostan Eval Kernel and Runner scope guard

Private, unpublished Bostan engineering (2026-10-26). Stacked after Draft PR #172. Never merge to main, publish, deploy, turn on inherited GitHub Actions or use paid inference without explicit later authorization.

## Real package/path migration

- Renamed the **actual workspace directory** from `packages/paperclip-eval-kernel` to `packages/bostan-eval-kernel` and changed the package name to `@bostan/eval-kernel`.
- Updated the Runner's genuine `devDependencies`/workflow-harness import and build selectors, full runner build-input digest paths/fixtures, source CI checks, Dockerfile asset paths, runner-vendor and Daytona-image source checks, package lock importer and current relevant docs. No parent source package name remains in active Runner/CLI/server source imports.
- SDK compatibility constant now reports `packageName:"@bostan/eval-kernel"`; the existing `paperclip.eval-kernel.compatibility.v1` **wire schema** remains unchanged and explicitly tested so saved records/consumers are not silently reinterpreted.
- The Bostan kernel is `private:true`, with no public `publishConfig`; both prepack and prepublishOnly fail through the existing Bostan release guard. GitHub Actions were NOT enabled.

## Security-critical scope fix

The standalone Runner's forbidden-import guard recognized only `@paperclipai/*`. Once the reviewed development-only kernel moved to `@bostan/eval-kernel`, that could allow unreviewed `@bostan/*` runtime imports/dependencies through a source-security policy blind spot. The guard now explicitly checks **both** inherited `@paperclipai/` and native `@bostan/` package namespaces. Only exact `@bostan/eval-kernel`, from the reviewed harness and declared `devDependencies:"workspace:*"`, retains the narrow reviewed exception. Negative fixtures demonstrate that other Bostan packages are forbidden from source imports and dependency sections; kernel remains forbidden in production, peer and optional dependency groups and when exposed from public exports. Do not relax standalone isolation during further package migrations.

## Verified engineering evidence

- Bostan private Eval Kernel actual TypeScript build and Node kernel suite: **3 PASS / 0 FAIL**; package identity and preserved schema explicitly verified.
- Runner build-inputs tests **11 PASS**, including updated digest source paths, detecting changed kernel source, symlink-path handling and concurrent build-record constraints.
- Runner import-boundary suite: **13 PASS, 1 FAIL**. All newly migrated exact-kernel/dev-only, forbidden production imports, transitive public export and new negative Bostan namespace tests PASS. The remaining `the package passes its standalone boundary` failure reports 3 source-relative imports outside `packages/paperclip-runner`: run-pr-vitest-lane test profile recorder, stage-runner-binary test script and native-instruction-measurement test fixture. These were **present before B0-24** in the parent source and must be resolved independently; we did NOT allowlist them or weaken the security rule. Do not claim the full security suite green.
- Mac Bostan source + guarded private release inventory: **239 PASS, 0 FAIL, 10 SKIP (249 total)** including 4 new owned-kernel source tests.
- Frozen lockfile/source workspace relink performed; full pnpm filtered `--force` refresh was stopped when it rapidly consumed local disk space. A single existing checkout-local symlink was corrected to the new kernel path without touching unrelated applications, user files or services. Never claim the entire dependency graph was cleanly force-reinstalled.
- Windows exact-head source results will be appended after verification.

## Release blocks

26 inherited package names before this wave, now 25 remaining. Further first-party adapters/shared/db/runner/sandbox-provider packages and versioned compatibility protocol names are pending. Full official server production build on a resource-qualified host, installed Windows release/GUI E2E, real model-authored independent signed governed Case closure, Runner security suite clean, third-party security signoff and host egress review are NOT complete. **NO-GO.**

## Bostan-first API aliases (nonbreaking source migration)

- The kernel now exports `BOSTAN_EVAL_KERNEL_COMPATIBILITY`, `runBostanEvalMatrix`, `BostanEvalScenario`, `BostanEvalCandidate`, `BostanEvalResult`, and `BostanEvalKernelConfigurationError` as owned Bostan entrypoints.
- Existing `PAPERCLIP_EVAL_KERNEL_COMPATIBILITY`, `runPaperclipEvalMatrix`, `PaperclipEval* types`, and original configuration error remain available as identical aliases so old callers and exact `instanceof` semantics survive. The wire schema is still `paperclip.eval-kernel.compatibility.v1`, **not silently invented as v2**.
- Bostan Runner's workflow harness now imports and invokes the new Bostan-first API. Real TypeScript kernel build **PASS** and all 3 native kernel tests PASS, including equality of old/new public aliases and unchanged wire schema.
- Verified the three out-of-boundary source-relative imports reported by the standalone Runner check exist **verbatim in parent B0-23 source commit**, not added by this migration. The standalone import-boundary result remains **13 PASS, 1 FAIL**, not a complete security pass.

## Exact-head cross-platform qualification — B0-24

- Mac source Node + guarded release suite: **239 PASS, 0 FAIL, 10 SKIP** (249 total).
- Windows `Abdulaziz` source Node + guarded release suite: **241 PASS, 0 FAIL, 8 SKIP** (249 total). On the first Windows run, the new source test assumed the *entire* old eval-kernel directory would disappear after `git switch`. Only ignored old build `dist` and `node_modules` remained, with no old tracked source or package.json. The test was narrowed to the required invariant: the original `packages/paperclip-eval-kernel/package.json` no longer exists. Re-ran source suite on Mac and Windows after patch, both green. We **did not delete** the Windows ignored directories or three pre-existing B023 untracked QA scripts.
- Mac actual local Bostan HTTP app + PostgreSQL synthetic company create, clean stop/restart, persisted readback and real headless Chromium private page: **PASS**, browser page errors 0 and blocked external browser requests 0, own test processes cleanly stopped.
- Reviewed Eval Kernel TypeScript build and test 3 PASS, Runner build input tests 11 PASS. Standalone Runner import-policy suite remains **13 PASS / 1 FAIL**, parent-known out-of-root imports, with no exception introduced.
- Windows remains a SOURCE QA result only, not a full installed Windows application, GUI, native model inference or release artifact gate. No paid provider or release action.
