# B1-197 — Windows PostgreSQL postmaster start identity

**PRIVATE DRAFT, UNMERGED, RELEASE NO-GO.** Stacked directly on B1-196 PR #453 at `e16f0008d2303a71e1705b0799f8c8372b847ed0`.

## Actual safety gap

The Windows embedded-PostgreSQL test stop helper previously accepted the PID in `postmaster.pid` when a CIM snapshot contained the same PID and pinned `postgres.exe` path. Windows may reuse a PID after a process exits. The source validated the CIM creation timestamp's syntax but did not compare it with the PostgreSQL marker's third line (Unix start epoch). A stale marker plus a newly created process from the same pinned executable could therefore be admitted for `pg_ctl stop`.

## Source repair

- Parse the third marker line as a bounded canonical decimal Unix epoch (seconds) from the same already-opened and identity-rechecked marker descriptor.
- Carry the strictly validated CIM UTC creation time through the process-inspection result.
- Require the matching PID, pinned executable, and process start time before invoking `pg_ctl`. The marker must not predate CIM process creation by more than one second of timestamp rounding or follow it by more than 120 seconds of bounded startup lag.
- Re-read and compare both PID and marker start epoch after asynchronous inspection, preserving the existing file identity and cluster ownership checks.
- Missing/malformed third line or mismatched process time fails closed without running `pg_ctl`, deleting fixtures, or revealing PID/paths.

The two-minute tolerance is a conservative compatibility bound, **not** a cryptographic identity proof, a Windows kernel attestation, or a native PostgreSQL acceptance result. The existing lstat-to-exec race and #234 forced-crash qualification remain open.

## Executed qualification

- Isolated native Linux container Node 22, exact GitHub helper blob `acc3fabd5c6de5bcef5f61b542f5bec124720d20` and test blob `39c242441541881abdd8eb794c4970e49db54d3a`: **6/6 Node built-in tests PASS**, zero skips, exit 0.
- Test-first local baseline before adding the helper: missing-module failure, exit 1. This is a missing-implementation baseline, not a demonstrated real Windows crash.
- Targeted TypeScript 5.8 NodeNext strict `--noEmit` declaration importer: exit 0; declaration blob `08aec6ea040fde29fc230901d1cce1268a1f7231`.
- Exact GitHub TS source and test integration: 8 source-structure assertions true; source blob `8728184ea36924bda4c47e955a1d868896e549b6`, Vitest test blob `bc64af9e075918ca7e39ba221e7157650cdc7c14`. The two new integrated Vitest regressions were **committed but not executed**.
- No native Windows test, real PostgreSQL, forced crash, full root TypeScript 7/Vitest, browser, or installed application was run. No user host, PostgreSQL process, or retained QA directory was touched.

## Required follow-up

Run the scoped native Windows Vitest suite and a genuine isolated owned PostgreSQL marker/CIM time comparison once Remote Desktop Commander usage access is legitimately restored and resources are safe. Keep `D:/Bostan-B212-qa` retained and unverified. Do not bypass device quota or weaken the fail-closed guard. #234 and #237 and full three-OS acceptance remain RELEASE NO-GO.
