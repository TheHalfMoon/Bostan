# B0-30 — Cross-platform native cold-snapshot test qualification

**Private development only — not standalone installer qualification.**
Tested October 24, 2026 against B0-29 parent and the current source tree.

## Failure isolated on Windows

The test fixture in `scripts/bostan-cold-snapshot.test.mjs` was a POSIX
`#!/bin/sh` script that returned synthetic `pg_ctl` statuses 0, 3 and 4.
Windows `spawnSync` correctly does not execute that shell script as a native
PostgreSQL utility. Consequently, it returned `unknown`, causing unrelated
backup/restore tests to fail **before the snapshot code was exercised**.
That failure does not establish a defective runtime backup, nor does it
qualify the native Windows app by itself.

## Narrow test-only change

- Retain the POSIX shell fixture without changes to live PostgreSQL logic.
- On Windows, compile a tiny `.exe` via native Windows PowerShell's built-in
  .NET C# compiler, once for the test suite. It accepts the same `-D
  <temporary-test-data-dir> status` CLI argument pattern as `pg_ctl`, then
  returns an explicitly stored synthetic status from that **test directory**.
- Compile into a randomly named test TEMP directory; clean the compiler's
  executable and all fixture directories after the tests. No downloading,
  administration, user database changes, persistent executable, Windows
  service registration, or PowerShell profile changes.
- Ordinary Windows symlink creation requires a privilege not available to
  this user. Verify symlink/reparse-point refusal via a native Windows NTFS
  **junction** in the fixture instead. The production snapshot walker remains
  unchanged and still refuses dangerous symlinks/reparse points.
- No change to `databaseStatus()` or its stringent requirement for actual
  `pg_ctl` exit status 3 before a *real* cold backup. Production behavior,
  existing data, and source protocol identifiers remain unchanged.

## Executed results

Same ten Node test files:

```
scripts/bostan-local-runtime.test.mjs
scripts/bostan-local-stop.test.mjs
scripts/bostan-runtime-recovery.test.mjs
scripts/bostan-windows-acl.test.mjs
scripts/bostan-first-agent-free-e2e.test.mjs
scripts/bostan-opencode-free-admission.test.mjs
scripts/bostan-cold-snapshot.test.mjs
scripts/bostan-ui-guide-links.test.mjs
scripts/bostan-repository-frontdoor.test.mjs
scripts/bostan-first-run-brand.test.mjs
```

- Windows Abdulaziz, Node v24.19.0: **80 tests; 74 passed, 0 failed,
  6 explicitly POSIX-only skipped**. Focused cold-snapshot suite:
  **17/17 passed with no skips**. The native .NET test compiler worked and
  the required junction was created and rejected by Bostan code.
- Mac macbook: **80 tests; 71 passed, 0 failed, 9 platform-only skipped**.
  Focused cold-snapshot suite: **17/17 passed with no skips**.
- Windows test files came from a fresh **detached, separate QA worktree**
  at commit `863bb8b`, preserving the user's existing old Bostan source
  checkout and its untracked QA scripts. No user credentials, databases or
  non-test content were opened or modified by the test suite.
- Explicit TEMP inspection showed **zero remaining**
  `bostan-pgctl-unit-*` or `bostan-cold-*` fixture directories on Windows.
- `git diff --check`: PASS.

## Remaining gates

The PG status utility used by these tests is a synthetic *native executable*;
this does not replace real native PostgreSQL E2E. Earlier B0-15/B0-22
receipts independently established real Windows PostgreSQL behavior on a
prior code frontier. A **new full Windows first-agent CLI E2E on the current
branch**, native installer install/upgrade/restore, production TLS/egress,
licensing, cross-platform E2E, B1–B6 product functionality and any release
remain open.

Repository remains private, Actions disabled, `main` unchanged, all PRs
unmerged Draft. **RELEASE NO-GO.**
