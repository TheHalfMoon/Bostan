# B1-72 — Missing Windows PostgreSQL data directory is not a clean shutdown receipt

Date: 2026-10-30. STRICT PRIVATE / ZERO-COST / NONPUBLISHING. Exact stacked parent private Draft #325 head `d79aeb80187db6b2bb7002bc2030ac0739f2e49f`.

## Confirmed, test-only false-positive

`stopOwnedWindowsEmbeddedPostgres()` previously returned `already-stopped` immediately whenever the PostgreSQL data directory did not exist. It skipped the prior B1-70 process proof, ownership checks and pinned `postgres.exe` binary snapshot. A directory can disappear after partial startup or an overlapping cleanup while a Windows PostgreSQL `io_worker` process is still alive. Filesystem absence is **not evidence of native process quiescence**.

Two new synthetic tests at the exact B1-71 parent proved the defect **RED**: the helper returned `already-stopped` for a non-existent directory both when the inspector would have reported a lingering pinned worker and when the inspector would have returned clean. The baseline suite was **11 PASS, 2 FAIL**. No native PostgreSQL was started to produce this evidence.

## Minimal fix

The missing-directory path now rejects with a fixed, privacy-safe **`Missing owned PostgreSQL data directory; retaining fixture`** error. It does not call `pg_ctl`, run CIM/PowerShell inspection, terminate a process, delete a directory or issue a false-positive `already-stopped` receipt. The caller's existing fail-closed stop/cleanup path must retain ambiguous surviving test assets for later owner-only inspection. Existing rules for an **existing owned directory with missing `postmaster.pid`** are unchanged: two clean pinned-binary snapshots and an additional marker reappearance check are still required.

## Objective evidence

Authorized native macOS source-only branch, Mac Node 26 and Vitest 5 under one worker and 1024 MiB heap: **15/15 PASS** across `windows-embedded-postgres-stop.test.ts` and `embedded-postgres-template-policy.test.ts`, including both previously RED regressions. Targeted TypeScript 7 strict `--noEmit --ignoreConfig` compile of the changed production-free test helper from the package workspace passed with 768 MiB memory cap; `git diff --check` PASS.

This is a **test-helper correctness repair** and is not a real Windows PostgreSQL shutdown qualification. Windows C/D free space in the live preceding inspection was below the established 6 GiB per-disk gate; no native Windows DB lifecycle, compiled HTTP/Better Auth, Chromium, or 180-second suite was run. No user or unrelated process/file was stopped or deleted.

## Still NO-GO

B1-70/71 pinned-executable-wide worker proof remains conservative across concurrent suites. Exact child PID/parent/start-time ownership and independent native Windows no-orphan qualification are still unproven. The complete app release remains NO-GO for Windows compiled startup, Linux native runtime, installers, untrusted agent sandbox, ongoing model cost guarantees, security/privacy/licensing/NOTICE/provenance reviews. Repository remains PRIVATE and the PR must remain DRAFT; no main merge, GitHub Actions enabling, publication, deployment, paid inference or customer data.
