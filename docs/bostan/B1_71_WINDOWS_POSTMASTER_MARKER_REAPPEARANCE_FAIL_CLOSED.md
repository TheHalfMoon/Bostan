# B1-71 — Fail closed if Windows postmaster.pid reappears during worker verification

Date: 2026-10-30. Parent: PRIVATE Draft PR #324, exact head 0ceee78a5bdd09684ce608241bba8d569e658947.

## Scope and failure mode

B1-70 required two consecutive clean snapshots of processes from the pinned Windows PostgreSQL executable. However, stopOwnedWindowsEmbeddedPostgres checked postmaster.pid only before that asynchronous verification. If the marker reappeared during the snapshots, both the already-stopped and stopped paths could still return success and allow the caller to clean up an owned scratch cluster whose identity had changed.

This change rechecks the exact validated cluster's postmaster.pid **after** the bounded process proof and **before** either successful return. If the marker has reappeared, teardown rejects with a constant privacy-safe message and retains the fixture through the existing failure path. No process is killed, no retained fixture is removed, and no production server code is changed. This is a narrow race mitigation, **not** an atomic proof against a restart after the final check.

## Objective evidence

- Native Mac Node 26.0.0 / Vitest 5.0.3, single worker, 1024 MiB heap: two new regression cases **RED** before the change (9 pass / 2 fail); both test marker reappearance during the second otherwise-clean snapshot, one with the marker initially absent and one after simulated successful pg_ctl stop.
- Same focused Windows shutdown + template-policy suite **GREEN: 13 PASS / 0 FAIL** after the change.
- TypeScript 7 targeted strict noEmit/ignoreConfig check under 768 MiB: **EXIT 0**.
- git diff --check: **PASS**.
- Read-only authorized native Windows resource check: approximately C 4.42 GiB free, D 5.45 GiB free, RAM 4.38 GiB free, no postgres.exe at inspection. Below established 6 GiB per-disk admission; no native PostgreSQL teardown, packed server, 18-stage Better Auth/HTTP, Chromium, or 180-second E2E executed.

## Unresolved release gates

The B1-70 executable-wide proof still cannot distinguish concurrent suites sharing the same pinned binary; exact PID/parent/creation-time ownership remains to be implemented and proven on Windows. A marker can still appear after the final check. Native Windows multi-suite #234 orphan-process proof, packed-runtime startup, #237 auth/HTTP, Chromium, offline agent, installers, cross-platform security/privacy and licensing/NOTICE remain **NO-GO**.

STRICT PRIVATE / DRAFT / ZERO-COST / NONPUBLISHING. No main merge, GitHub Actions, publishing/deploy/release/npm pack, paid models/compute/cloud, customer data, unrelated process termination, disk cleanup, or deletion of retained fixtures.
