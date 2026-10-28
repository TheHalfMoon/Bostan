# B1-02 — Prove Windows QA child closure before DB teardown

Date: 2026-10-28. Bostan remains **PRIVATE**, all changes **Draft only**, release **NO-GO**. B1-02 stacks on B1-01 PR #253. No Actions activation, merge, publication, deployment, paid models or customer data.

## Specific failure mode

The B1-00 Windows real authenticated HTTP harness called `spawn()` and then watched only the child `exitCode` and `signalCode`. Node can emit an asynchronous `error` on launch (e.g. nonexistent executable / ENOENT); without a listener this is an unhandled error in the parent. Further, observing an exit code/signal is not equivalent to the ChildProcess `close` event, which confirms stdio streams closed. The harness needed a bounded, observable child lifecycle before touching test PostgreSQL and the fixture.

## Repair

- Added `scripts/bostan-private-windows-child-lifecycle.mjs`: `observeOwnedQaChild(child)` immediately installs `error` and `close` handlers on the **specific ChildProcess returned by that QA spawn**. It never scans PIDs, kills other processes or touches PostgreSQL directly.
- The helper exposes `exitedOrFailed` for stopping the bounded localhost health polling when the child fails, and a bounded idempotent `stop()` that sends SIGTERM to that **owned handle** and escalates to SIGKILL only if `close` is not observed in the grace period.
- `stop()` yields a bounded, path/token-free receipt `{closed,spawnError,forceUsed}`. A signal/exit code alone does **not** set `closed`. A failed spawn remains a failure even if the child eventually emits `close`. Any force escalation fails QA qualification instead of quietly reporting success.
- Updated `scripts/bostan-private-windows-live-http.mjs` to install the monitor immediately after `spawn` and before the stream listeners, break health polling on failure, and gate PostgreSQL teardown and fixture reclamation on the actual `close` receipt. Emit `BOSTAN_WINDOWS_LIVE_SERVER_SPAWN_FAILED`, `...FORCE_TERMINATION` and `...TEARDOWN_UNCERTAIN` as needed; never log raw exceptions.
- Updated source-level regressions in `scripts/bostan-private-windows-live-http.test.mjs`. This source-level suite itself has not been executed against the full native repo yet.

## Verifiable local execution

On isolated Linux Node **22.16.0**, created the exact module/test source and checked their Git blob hashes against the **same bytes in GitHub**:

| File | Git blob |
|---|---|
| `scripts/bostan-private-windows-child-lifecycle.mjs` | `6b2e248bb80f95f210a900ee2c3c5f593b13670d` |
| `scripts/bostan-private-windows-child-lifecycle.test.mjs` | `7bed1039aee34944fc317ae5bc7e231eefd4d214` |

The actual `node --test` result was **7 passed, 0 failed, 0 skipped**. Cases used real spawned Node child processes for normal termination, missing executable `error`, stubborn process requiring SIGKILL (Linux-specific), concurrent stop idempotence, and invalid inputs. Two deterministic EventEmitter cases verified that `exitCode=0` without a `close` event **never** qualifies, and that an `error` followed by `close` remains failed. `node --check` passed for both files.

The changed Windows parent source is Git blob `13b103a8788aced959c846da8d3db7cc24ac8fda`. Its isolated JavaScript parser check passed, and 8 source-level checks verified immediate observation, early polling break, stop before PG cleanup, error/forced-shutdown diagnostics, preserve uncertain fixtures, green receipt after teardown, and disk admission preceding DB startup. **This is source inspection, not running the full native parent.**

## Remaining release blockers

- Native Windows: B0-91 admission still requires at least 2 GiB on C: and 6 GiB on test checkout/TEMP. Most recent measured C: free was ~0.323 GiB. Do not initiate heavy PG/HTTP/browser runs while below threshold or delete user data to make room.
- Native Windows hosted test is not yet rerun on this B1-02 branch; it still must prove Bostan server import and real private HTTP 200, synthetic sign-up cookie, first-admin, tenant boundaries and safe teardown.
- PostgreSQL `postgres.exe --forkchild=io_worker` descendants after the native test remain Issue #234. An actual post-run Windows process-tree/owned executable check must show zero orphaned workers. `close` of the Node server does **not** prove all owned PostgreSQL workers have exited; the existing safe receipt must continue `noOrphanPostgresProcessVerified:false`.
- Desktop Commander access had reached its monthly usage quota: do not retry/reconnect while suspended. When legitimate access returns, use a fresh owned `Bostan-B102-qa` checkout and matching `Bostan-B102-temp`, Node 24.11+, frozen scope deps, run the pure lifecycle/env/wave suites and server source tests before opt-in heavy native PG/HTTP. Preserve only verified test-owned fixtures if shutdown is uncertain; never kill unrelated processes.
- Mac full 16-stage real HTTP with latest security guards, Mac/Windows Chromium Playwright, real zero-cost local agent task, compiled builds, installers, licensing and other independent safety/security qualifications are pending.

**Bostan remains PRIVATE, Draft, NO-GO until those gates pass.**