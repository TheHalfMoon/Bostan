# B1-85 — Recheck owned Windows PostgreSQL cluster identity before shutdown

Date: 2026-10-31. **STRICTLY PRIVATE · ZERO COST · NONPUBLISHING · STACKED DRAFT ONLY.**

## Exact parent and safety admission

Based on B1-84 Draft PR #339, branch `work/b1-84-windows-pid-marker-path-replacement-fail-closed`, exact parent commit `c271b153c73851aff979d0a53aab40581d0995d7`. Live GitHub repository visibility was `private`; `main` remained at `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a` and reported `protected:false`. No merge, publish, Actions enable, deployment, npm pack, paid model/cloud, customer data, retained-fixture deletion or foreign process kill.

The connected Windows Desktop Commander device ID was `62835bd9-9ffe-4bd5-9010-6ac23b2d7223`, **not** the previously authorized `6641fb27-1a94-40b7-a76d-06e5e61a49af`. Therefore no Windows execution, native PostgreSQL stop, or heavy QA was attempted. Authorized Mac was used for isolated synthetic testing.

## Reproduced defect before fix

The Windows test-only shutdown helper captured `PG_VERSION` and directory identity at entry, then validated `postmaster.pid` before invoking `pg_ctl`. Its next cluster identity verification occurred **after** invoking the shutdown command. A concurrent mutation of `PG_VERSION` during PID validation therefore allowed `pg_ctl` to be called against a changed cluster before the helper finally failed closed.

A new deterministic synthetic Mac regression intercepts the second `fstatSync` during PID validation and changes the **same** owned `PG_VERSION` file's contents from `18` to `17`, retaining the same length. It injects a fake runner (never invokes real `pg_ctl`) and a fake process inspector. On the exact unmodified B1-84 source, the test failed: **43 PASS / 1 FAIL / 1 SKIP**, because the fake shutdown runner was invoked once, despite the later cluster-identity error. The fixture was created and removed by the test's own scoped helper.

## Narrow repair and objective checks

The helper now calls the existing `assertClusterIdentityUnchanged()` **immediately after** successful PID marker validation and **before** invoking `run(pgCtlExe, ...)`. The original post-shutdown cluster verification is retained. No change to production server, release flags, real process inspection, command arguments or teardown timeouts.

- Mac Node 26 / Vitest 5 / one worker / 1024 MiB: **44 PASS / 0 FAIL / 1 SKIP** after repair (45 tests).
- Targeted strict `pnpm --filter @bostan/db exec tsc --noEmit -p tsconfig.json`: **EXIT 0**.
- `git diff --check`: **PASS**.
- The new test proves **zero** fake shutdown calls and **zero** fake process inspections on a changed version marker; it is synthetic, not a native Windows PostgreSQL run.

## Limitations — release NO-GO

This preflight narrows one deterministic race but is **not an atomic operating-system guarantee**: a cluster could still change after the last check and before `pg_ctl` executes. The helper also does not prove ownership of the PID or any real multi-suite worker quiescence. Windows #234 genuine PostgreSQL no-orphan qualification and #237 packed-server Better Auth/HTTP/Chromium remain open; the independent import worker previously showed main-thread startup blocking and incomplete CPU attribution. Full Linux/Windows/macOS installers, genuine free offline agent, security/privacy and copy-first license/NOTICE audits remain release gates. Do not claim release-ready.
