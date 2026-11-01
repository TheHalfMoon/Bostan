# B1-175 — Await the same supervised PostgreSQL shutdown across callers

Date: 2026-11-01 Asia/Riyadh. STRICT PRIVATE / ZERO COST / DRAFT / UNMERGED / RELEASE NO-GO.

## Defect and repair

At exact stacked Draft #432 HEAD `6a0dc5ee74415f228d527af856552d801233cd5a`, `server/src/embedded-postgres-supervisor.ts` returned immediately for second and subsequent `shutdown()` calls while the first call awaited recovery and/or `activeInstance.stop()`. A second awaiter could incorrectly assume PostgreSQL was quiescent. A second, independent path swallowed a `replacement.stop()` error during shutdown because it caught it as an ordinary recovery attempt failure, so **even the first shutdown could resolve successfully after a failed replacement stop**.

The source now memoizes `shutdownPromise` and returns exactly that same promise to every caller, including after fulfillment or rejection. It sets `shuttingDown` before creating the asynchronous completion operation, awaits the in-flight recovery, and then stops the active native instance if still running. While shutting down, recovery now rethrows any replacement startup/stop failure rather than hiding it behind restart callback logic. Production PostgreSQL binary, process owner, disk cleanup and native Windows test helpers remain unchanged.

## Test-first evidence

All tests use an isolated synthetic test fixture; **no real PostgreSQL server, database or child process** was started. The Mac test source and production source were SHA-matched to the GitHub changed-file blobs, not an old local copy.

- Native macOS arm64 Node 26 / Vitest 5: original unchanged supervisor and 3 existing tests **3/3 PASS**.
- RED: 3 added deterministic deferred-stop tests on old source: **3 PASS / 3 FAIL**, proving premature completion, lost stop rejection and early completion during replacement recovery.
- Independent RED: with shared-promise fix but unchanged recovery catch, new replacement-stop rejection test **0/1 PASS (1 FAIL)**, proving error masking.
- Exact candidate GitHub source blobs: `server/src/embedded-postgres-supervisor.ts` **db009808148d4fba710d79345cd6f3f9fab12e77**; `server/src/__tests__/embedded-postgres-supervisor.test.ts` **74643af130735b6a75eeb0c092c5753eb10caaa2**. Both independently confirmed via native `git hash-object` on the Mac QA copy.
- FINAL native Mac same exact blobs: **7/7 Vitest tests PASS, 0 failures/skips, exit 0**; targeted TypeScript 7 strict `--noEmit` **exit 0**. Full root TypeScript, compiled server and native PG lifecycle were NOT run or qualified.

## Scope and release limitations

This qualifies the in-memory supervisor contract against synthetic races. It does **not** prove PostgreSQL native forced-crash child ownership, real cross-process zero-orphan teardown (#234), compiled Windows auth/Chromium (#237), the POSIX deferred-stop timeout/fixture issue (#431), unprivileged Linux sandbox, installers, full root TS7, authenticated tenant isolation or source license review. Product remains **RELEASE NO-GO**. Do not merge main, run Actions, publish/deploy/release, pay for providers, use customer data, kill other processes or delete retained or foreign files.
