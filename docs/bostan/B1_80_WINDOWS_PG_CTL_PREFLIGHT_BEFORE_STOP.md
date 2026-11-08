# B1-80 — Validate Windows pg_ctl executable identity before any shutdown request

**Scope:** STRICTLY PRIVATE / ZERO COST / NONPUBLISHING / TEST-ONLY. **Release:** NO-GO.

**Stacked parent:** B1-79 Draft PR #334, branch `work/b1-79-windows-cim-executable-root-leaf-identity`, exact head `d5287f7e0c25658ec1d4738ab0570cd500c46c65`. No main merge, rebase, Actions, or release.

## Reproduced safety defect

The Windows test-only PostgreSQL teardown accepted `path.win32.isAbsolute(pgCtlExe)` and a `pg_ctl.exe` basename before invoking the injected/native shutdown runner. On Windows, `isAbsolute("\\unanchored\\pg_ctl.exe")` accepts a drive-less rooted path. The stricter `normalizedExecutable` validation was applied only **after** the shutdown runner returned, inside `provePinnedBinaryQuiescent`. An ambiguous shutdown path could therefore be executed before rejection.

On the exact B1-79 source, a read-only, in-memory Node reproduction with a newly owned synthetic `PG_VERSION` and `postmaster.pid` fixture produced `ERROR=B180_SENTINEL` and `RUN_CALLED=true`. The fixture was removed by its own test harness. This is a demonstrated preflight-order defect, **not** evidence of a real PostgreSQL process being stopped.

## Narrow fix

- Add `normalizedPgCtlBinary` to validate the **original** `pg_ctl.exe` spelling, then derive and normalize its corresponding `postgres.exe` path without `path.join` erasing dot segments or drive-less roots.
- Reject ambiguous shutdown paths before `run(pgCtlExe, ...)`, process inspection, or any success receipt.
- Reuse the same normalized binary identity in the post-shutdown worker-quiescence proof, avoiding preflight/postflight disagreement.
- Preserve fully anchored Win32 drive, extended-length drive, and UNC paths; no foreign process termination and no production server changes.
- Add regression tests for drive-less root, dot segments, device namespace, valid extended-length drive, and valid UNC paths.

## Objective verification on exact code head

- **Mac Node 26 / Vitest 5**, isolated archive of code commit `e4def61f45955354e349c584e03265adb0a184c7`: **39 PASS / 0 FAIL / 1 SKIP** (40 tests), one worker. Existing Mac-specific skip unchanged.
- **Mac targeted TypeScript 7 strict `tsc --noEmit -p packages/db/tsconfig.json`**: EXIT 0, executed inside the same isolated exact-commit archive.
- **Native Windows 11 / Node 24.19.0**, exact SHA source loaded in memory using `stripTypeScriptTypes`: **5 PASS / 0 FAIL** on three invalid and two valid paths, using newly owned synthetic fixtures. Owned fixtures and the one-off test script were cleaned. This is **not** the full Windows Vitest suite.
- **Mac independent source-execution smoke**: **5 PASS / 0 FAIL**, newly owned synthetic fixtures cleaned.
- **Git diff --check** against exact parent: PASS.
- Temporary Mac archive was deleted by its own exit trap; original worktree, its untracked browser cache, and retained Windows QA evidence were not modified.

## Resource admission and limitations

At the read-only native Windows admission: C free **6.25 GiB**, D free **12.17 GiB**, RAM free **5.23 GiB**, `postgres.exe` count **0**. No packed build, 180-second E2E, real embedded PostgreSQL, Chromium, installer, paid model, or cloud workload was launched.

**NO-GO remains:** exact PID/parent/creation-time ownership, real Windows multi-suite no-orphan proof (#234), packed server startup/Better Auth/18-stage HTTP (#237), offline agent, Chromium, Linux, installers, security/privacy, and copy-first license/NOTICE gates remain unqualified.

No merge to main, Actions enablement, publishing, deployment, release, npm pack, paid compute/models/cloud, customer data, deletion of retained fixtures, foreign process kills, or local disk cleanup.
