# B1-66 — Windows private packed import probe early-exit deadline cleanup

Status: **DIAGNOSTIC ONLY — RELEASE NO-GO**. PRIVATE, ZERO-COST, NONPUBLISHING. Exact stacked parent: Draft B1-65 (#319), head `7ad2a69416918de75137a5289aa98adff400d181`. No production server or runtime bundle changes, main merge, GitHub Actions, paid services, release, deployment, npm pack, customer data or foreign process termination.

## Reproduced source defect

The private Windows packed import probe previously awaited `Promise.race([child close, setTimeout(36_000)])`. When the owned packed child exited early (for example, the intentional rejecting PostgreSQL stub caused an immediate `ECONNRESET`), the losing timer was **not cancelled**. It could keep the diagnostic parent alive until the original 36-second deadline, even though the child had already closed. This contaminates elapsed-time measurements and consumes a Windows QA slot unnecessarily. It is a QA harness lifecycle defect, **not** evidence of a product startup root cause.

## Scoped repair

- Added `waitForPrivateWindowsImportProbeChild` to cancel the deadline on child close, detach the close listener at deadline, and retain the exact `child_exited` / `bounded_36s` outcomes.
- Fail closed on invalid child objects or deadlines; deadline cannot exceed 36 seconds. A late child close after timeout cannot turn a bounded result into a success.
- The original SHA256 runtime admission, strict private QA guard, synthetic loopback rejecting PostgreSQL stub, 36-second maximum, owner-only cleanup, CPU-profile fail-closed behavior, trace privacy, and `TRACE_QUALIFIED=false` are unchanged.
- No new runtime dependency, model call, database, Chromium run or production code modification.

## Executed native Windows evidence — 2026-10-30

Authorized Windows device Abdulaziz (Node v24.19.0), isolated `D:\Bostan-B166-qa` clone from exact B1-65 head, with no changes to original B165/B144 checkouts. Before work, repository PRIVATE, Draft #319 exact head/base verified, main at `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a` with `protected:false`, GitHub Actions disabled; Mac offline. Preflight ~3.58 GiB free RAM, ~6.48 GiB free D:, so no heavy build or 36-second packed probe was attempted.

- Regression-first: new test initially failed with `ERR_MODULE_NOT_FOUND` before helper existed (expected RED).
- After repair: **15 tests total, 13 PASS, 0 FAIL, 2 SKIP** (Windows symlink privilege), including a real native Node child exiting promptly, fake-timer cancellation, deadline and late-close cases, and existing ESM trace / probe-exit regression cases.
- Expanded eight-file native Windows focused suite: **43 total, 40 PASS, 0 FAIL, 3 SKIP** (Windows symlink privilege). `node --check` for helper and packed probe: PASS; `git diff --check`: PASS. Inert packed-probe `--plan` returned EXIT 0 with `run:false`, `realDatabase:false`, `deadlineSeconds:36` and `releaseQualified:false`.
- No real PostgreSQL, Better Auth, HTTP, Chromium, semantic TypeScript build, or full Windows startup qualification was run in this wave.

## Remaining gates

The intermittent packed ESM startup delay is **not fixed or explained** by cancelling a parent-side timer. Next perform a resource-safe bounded comparison of actual child-close-to-parent-exit timing, then isolate ESM cold-start variance without asserting a culprit from the last digest. A genuine Windows packed HTTP/Better Auth/Chromium/12-concurrent-write one-PostgreSQL run and independently verified multi-suite orphan cleanup (#234/#237), Linux, installers, offline agent sandbox, security/privacy and license/NOTICE remain required. **Release NO-GO.**
