# B1-79 — Fail closed on ambiguous Win32 CIM executable roots and leaf names

**Scope:** STRICTLY PRIVATE / ZERO COST / NONPUBLISHING / TEST-ONLY. **Release:** NO-GO.

**Exact stacked parent:** B1-78 Draft PR #332, `work/b1-78-windows-cim-path-identity-fail-closed`, HEAD `57fa8798e7ce2209241f52e7b0d8291af421894e`. No rebase, main merge, Actions, deployment, release, or publication.

## Reproduced source-level defects

`path.win32.isAbsolute("\\unanchored\\postgres.exe")` is true even though the executable path is rooted on an *unknown current drive*. The previous normalization classified this ambiguous CIM `ExecutablePath` as an unrelated executable and could issue a false `already-stopped` receipt. A CIM row queried with `Name='postgres.exe'` but containing a different executable leaf (e.g. `C:\\foreign\\not-postgres.exe`) was likewise classified as foreign.

On the exact B1-78 source plus two new regression tests, authorized macOS Node 26 / Vitest 5 returned **33 PASS / 2 FAIL / 1 SKIP**: both new cases incorrectly resolved `already-stopped`.

## Narrow mitigation

Require a fully anchored Win32 drive path (`C:\\...`) or UNC server/share path (`\\\\server\\share\\...`), and require the normalized executable leaf to equal `postgres.exe` without a trailing directory separator. Unrecognized paths fail closed with existing constant error messages and owned fixture retention. Preserve B1-78 extended-length alias support and distinguish valid foreign PostgreSQL installations without stopping them.

Use `path.win32` for the pinned `pg_ctl.exe` path checks and test fixture construction even on macOS; this makes synthetic cross-platform tests exercise actual Windows path semantics rather than accepting a POSIX path accidentally. No production server changes, foreign process termination, or retained-fixture deletion.

## Objective verification

- Authorized Mac Node 26 / Vitest 5, one worker, 1024 MiB heap: **37 PASS / 0 FAIL / 1 SKIP** on 38 focused synthetic tests.
- Targeted TypeScript 7 strict `--noEmit` from `packages/db`, 768 MiB: **EXIT 0**.
- `git diff --check`: **PASS**.
- Native Windows tests: **not yet executed for B1-79**. Prior B1-78 native Windows tests do not qualify this change.
- Read-only Windows admission before this work: C **6.27 GiB**, D **12.17 GiB**, free RAM **5.34 GiB**, 0 postgres.exe. No heavy build, real PostgreSQL, or 180-second HTTP E2E was attempted.

## Unresolved gates

This is synthetic CIM identity hardening, **not** exact PID/parent/creation-time ownership or real multi-suite Windows PostgreSQL no-orphan proof (#234). Packed-server startup, Better Auth/HTTP 18-stage Windows E2E (#237), Chromium, offline agent, installers, Linux, security/privacy and copy-first license/NOTICE checks remain unqualified. **Release NO-GO.**

No merge to main, GitHub Actions enablement, publishing, deployment, npm pack, paid compute/models/cloud, customer data, deletion of retained fixtures, foreign process kills or local disk cleanup.
