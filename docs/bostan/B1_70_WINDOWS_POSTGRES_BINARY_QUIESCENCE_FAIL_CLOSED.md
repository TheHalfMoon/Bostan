# B1-70 — Native Windows PostgreSQL teardown: bounded binary-quiescence gate

Date: 2026-10-30. Parent: PRIVATE Draft PR #323, exact head `3ea489ca310b3a6ae3b6a5de9de99b320d059045`.

## Defect and bounded mitigation

Issue #234 reproduced orphaned `postgres.exe --forkchild=io_worker` processes after successful Windows database suites. The existing `stopOwnedWindowsEmbeddedPostgres` returned `already-stopped` whenever `postmaster.pid` was absent, or `stopped` immediately after `pg_ctl stop` removed that marker. Neither condition independently established that Windows PostgreSQL workers had exited. The caller could then delete its owned scratch cluster.

The new test-only teardown uses a bounded native Windows CIM process query after either condition. It collects **only** PID, parent PID, executable path and UTC creation timestamp; it never collects command lines, environment variables or raw logs. It requires two consecutive process snapshots with no processes from the exact pinned `postgres.exe` adjacent to the supplied `pg_ctl.exe`. It retries for at most 20 snapshots, separated by 250 ms (plus bounded inspection time), then fails closed. Any unavailable/ambiguous process identity or failed inspection fails closed. It never terminates any process. A failed proof rejects the stop promise, so the existing Windows cleanup path retains the fixture rather than deleting a potentially active cluster.

This is deliberately **conservative**: a different concurrent Bostan suite using the same pinned executable can block cleanup, even if it is unrelated. An inspectable foreign PostgreSQL executable is not blocked or killed. A stronger PID/parent/creation-time ownership graph, race-aware multi-suite tests and actual zero-orphan proof are still required. This does not fix orphan creation, and does not make template caching safe; B1-69's Windows cache bypass remains enabled.

## Objective tests and platform evidence

- Mac Node 26.0.0 / Vitest 5.0.3, one worker, memory cap 1024 MiB: 11 PASS, 0 FAIL across Windows teardown policy and template-cache policy. Cases include absent PID with live worker, bounded retry, two clean snapshots, failed/ambiguous inspection, foreign executable, stale marker, symlink and invalid cluster identity.
- Mac isolated TypeScript 7 targeted strict no-emit check of the helper with 768 MiB cap: EXIT 0.
- Real native Windows PowerShell 5.1 **read-only** CIM probes: PostgreSQL process query returned an empty JSON array; a structurally identical Node-process query proved that native `CreationDate` must be explicitly serialized to an ISO UTC string. The helper uses that verified projection. This is **not** a real Windows PostgreSQL teardown run.
- Windows resource admission: approximately C 4.78 GiB free, D 5.51 GiB free, RAM 2.71 GiB free at initial check. Below the established 6 GiB per-disk threshold. No heavy build, database, Chromium or 180-second E2E was run.

## Remaining gates

Native Windows synthetic fixture with real pinned PostgreSQL, live worker and missing marker; verify no deletion and no foreign process termination. Demonstrate successful bounded stop, zero owned `io_worker` processes, and zero owned scratch directories over multiple sequential and concurrent suites (#234). Then requalify packed runtime startup, 18-stage Better Auth/HTTP (#237), Chromium, offline agent, installer, security/privacy and licenses/NOTICE. **Release NO-GO.**

Strictly PRIVATE, DRAFT and stacked. No merge to main, Actions, publishing, deploy, release, npm pack, paid model/compute/cloud, customer data, disk cleanup or foreign process kill.
