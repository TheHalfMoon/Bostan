# B1-73 — Duplicate Windows PostgreSQL PIDs invalidate a clean worker snapshot

Date: 2026-10-30. STRICT PRIVATE / ZERO-COST / NONPUBLISHING. Stacked parent B1-72 private Draft #327 at exact head `3659491b1fcbc8c4aafa3910fc60d79916049dbf`.

## Proven test-only false-positive

The B1-70/71 native Windows worker-quiescence helper required two consecutive CIM snapshots with no process matching the pinned `postgres.exe` executable, and validated each row's PID, parent PID, executable path and creation date. But it **did not check PID uniqueness within each snapshot**. Two entries with the **same PID**, whether otherwise identical or contradictory, could both be treated as foreign and make the function return a verified `already-stopped` result. This is an ambiguous process-identity report, not trustworthy proof that workers have stopped.

At B1-72 parent, two new controlled regression cases **RED**: identical duplicated foreign-PID rows and duplicate IDs with conflicting executable paths both incorrectly returned `already-stopped`. The previously existing 13 tests passed, so the baseline was **13 pass / 2 fail**. This does not claim native CIM has actually returned duplicate rows on the user's machine; it is a synthetic validation boundary test.

## Narrow fix

For each complete process snapshot, after the existing type/metadata checks and before assessing quiescence, require that the number of unique positive integer ProcessId values equal the number of rows. Any duplicate returns the same conservative fixed privacy-safe error class, retains the synthetic cluster fixture and does not invoke a process kill or delete files. This preserves all existing owned path checks, marker reappearance controls, pinned executable-wide proof, deadline and prohibition on terminating foreign processes.

## Objective evidence

On an authorized Mac with Node26/Vitest5, capped 1024MiB heap and one test worker, **17/17 PASS** across Windows shutdown and template cache guard regression tests. Both previously failing tests passed after the fix. Targeted TypeScript7 strict `--noEmit --ignoreConfig` compilation of the changed test helper passed within the 768MiB cap. `git diff --check` PASS. No native PostgreSQL cluster was started and no unowned process touched.

## Limits

This guards an internally inconsistent CIM snapshot. It does **not** prove that native PostgreSQL workers are all attributable to an exact owned cluster, does not address process-ID reuse between separate snapshots, and does not qualify native Windows teardown or the compiled app's real HTTP/Chromium startup. Current Windows disk admission remains below the existing >=6GiB required minimum; no costly native Windows database or browser E2E was attempted. Full Linux, installers, security/privacy/license/NOTICE/provenance and untrusted-agent sandbox remain NO-GO. Keep PRIVATE/DRAFT; no protected main merge, Actions, publishing, deploy, paid model, customer data or cleanup of unrelated user files.
