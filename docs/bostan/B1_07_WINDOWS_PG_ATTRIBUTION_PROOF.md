# B1-07 — Conservative Windows PostgreSQL process attribution and exact evidence

Date: 2026-10-28. Bostan PRIVATE. Stacked Draft on B1-06 PR #258, verified base head a65b525b9de7428811327851fc9b61205daaabb8. **Not** merged, deployed, released, published, or run against user data. GitHub Actions remain disabled.

## Proven source defects

1. B1-05's read-only PowerShell scanner counted a postgres.exe as owned only when its ExecutablePath was inside the repository root. It **silently ignored** processes whose executable was outside the checkout. The @embedded-postgres/windows-x64 native executable can be resolved from a package store outside the checkout (e.g., a redirected pnpm virtual store). Therefore a leftover native PostgreSQL worker outside the checkout could produce a **false zero-owned/zero-uninspectable** receipt. This is a source-level counterexample, **not** a demonstrated live Windows orphan.
2. B1-05's strict evidence interpreter used trimEnd() on stdout. It accepted extra trailing blank lines/whitespace even though the contract claimed exactly three PowerShell output records.

## Changes

- The existing **read-only** PowerShell scanner now increments UNINSPECTABLE for **every** postgres.exe process it cannot positively attribute to a binary under the checkout, including executable paths outside the checkout. It still counts in-checkout processes as owned, and inaccessible paths as uninspectable. Any nonzero count fails closed. This deliberately treats **unattributed** as uninspectable for the existing receipt schema; it does **not** inspect or terminate unrelated processes. The consequence is a conservative **NO-GO** if any unrelated PostgreSQL instance is running, even when healthy. A future native-specific ownership mechanism may improve attribution without weakening safety, but **never** stop unrelated processes just to pass QA.
- The JS evaluator now accepts exactly three ordered PowerShell records followed by exactly one final CRLF or LF newline, with no extra blank lines, trailing spaces, prefix/suffix lines, malformed statuses, nonzero exit, timeout/signal/error, or stderr. It still returns only bounded non-sensitive reason codes and never echoes process details.
- Existing native Windows authenticated HTTP runner remains wired to the same scanner and 16-stage evidence. No new Windows qualification is asserted.

## Genuinely executed evidence

In a fresh isolated test directory /mnt/data/bostan-b107-test on Linux Node **22.16.0**:

- node --check on the exact new JS evaluator and test files: **PASS**.
- node --test scripts/bostan-private-windows-pg-orphan-proof.test.mjs: **8/8 PASS**, 0 fail, 0 skip. Includes a real zero-exit Node child correctly refused without process proof, plus synthetic counts, duplicate/reordered/missing records, whitespace/extra-blank-line counterexamples, error/timeout/stderr, secret non-disclosure, and source-level checks of the PowerShell read-only fail-closed branch.
- The three exact local file hashes matched the GitHub blobs **after write**:
  - scripts/bostan-private-windows-pg-orphan-proof.mjs — b5661cdf3fd766a98288b500335f4e762a2601e5
  - scripts/bostan-private-windows-pg-orphan-proof.test.mjs — 6a608b340c4b12a2101ba41ed5592afdff5395fe
  - scripts/bostan-native-windows-postgres-no-orphans.ps1 — 561ac3e6201493a4118fd018f8f164c8a732ad6b
- **NOT EXECUTED**: PowerShell script on Windows, actual Get-CimInstance, native PostgreSQL cluster, io_worker detection, real authenticated HTTP startup, Chromium Playwright, Mac tests, compiled server build, agents, installers. The PowerShell behavior is checked only via source-level assertions; the Node interpreter is executed against synthetic stdout. No native process-zero proof has been established.

## Remaining release gates / safe next step

Issue [#234](https://github.com/TheHalfMoon/Bostan/issues/234) (native PostgreSQL worker/orphan proof) and [#237](https://github.com/TheHalfMoon/Bostan/issues/237) (Windows full authenticated HTTP startup and Chromium) remain **OPEN**. The last observed Windows C: free ~0.323 GiB, below the B0-91 2 GiB system and 6 GiB workspace/TEMP thresholds; native RAM has not been measured. Authorized desktop access was previously quota-blocked; do not retry or circumvent. When legitimately available and resource-safe, run the exact B1-07 head from an owned Bostan-B107-qa and Bostan-B107-temp, Node >=24.11 and frozen dependencies. Observe all 16 ordered real HTTP stages and independently verify no owned/unattributed PostgreSQL workers; if another PostgreSQL instance is running, fail closed without touching it. Then independently qualify Mac HTTP, Windows/Mac Chromium Playwright, zero-cost live agent workflow, reproducible compiled server, installers, licensing/security and recovery.

**Overall release NO-GO; Bostan PRIVATE Draft only.**
