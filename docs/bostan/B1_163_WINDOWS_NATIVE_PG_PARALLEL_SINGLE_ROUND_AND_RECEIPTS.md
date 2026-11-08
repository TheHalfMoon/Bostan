# B1-163 — Windows parallel PostgreSQL three-suite and truthful repeatability receipts

**2026-11-01 Asia/Riyadh | PRIVATE / DRAFT / UNMERGED / ZERO COST / RELEASE NO-GO**

Direct parent: private PR #419, source SHA `d0c9aaeb447f7b3140c97585f27f3f2d537baba2`. This checkpoint contains a narrow source fix to the PowerShell QA receipt and verified authentic Windows test evidence.

## Genuine source-native Windows parallel PostgreSQL result

Authorized Windows 11 Node v24.19 B177 private Git worktree was clean, originally detached at `e02229502d664a3594174886752e794a3a43edaf` with sparse scope only `packages/db`. Fetched/checked out exact PR #419 parent SHA, materialized `scripts` in the temporary sparse QA scope without touching docs/UI, verified clean. A **new** matching `D:\Bostan-B177-temp` had not existed. It was created for this task with only the exact owner marker `BOSTAN_QA_OWNED` containing `BOSTAN_TEST_ONLY` plus LF; there were no preexisting files or subdirectories in it.

Pre-run: zero postgres.exe processes, RAM ~6.48 GiB free, D: ~11.37 GiB free, all three checked-in DB test files and pinned Vitest available. Under session-local TEMP/TMP pointing only at this owned directory, ran native PowerShell script with explicit opt-in:

~~~powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts\bostan-private-windows-pg-three-suite-repeat.ps1 -Run -Rounds 1
~~~

**REAL NATIVE result: 3/3 files and 3/3 tests PASS, EXIT 0, 136.71 seconds.** Vitest ran the following three distinct source migrations/tests with `--pool=forks --maxWorkers=2`, a bounded test and hook timeout of 90 seconds, and real temporary migrated embedded PostgreSQL:

- `packages/db/src/session-goal-migration.test.ts`
- `packages/db/src/status-card-migrations.test.ts`
- `packages/db/src/chat-tenant-foreign-keys.test.ts`

Observed actual native stage markers:

~~~text
BOSTAN_B105_POSTGRES_NO_ORPHANS_PASS
BOSTAN_B105_PARALLEL_ROUND_1_START
BOSTAN_B105_VITEST_EXIT=0
BOSTAN_B105_THREE_REAL_SUITES_PASS=True
BOSTAN_B105_POSTGRES_NO_ORPHANS_PASS
BOSTAN_B105_ROUND_1_GREEN_NO_RETAINED_FIXTURES
BOSTAN_THREE_SUITE_EXIT=0
~~~

An additional independent post-test CIM/process and filesystem probe confirmed **zero postgres.exe processes**, the owned TEMP had **only the one originally created marker file**, the exact checked-out Git worktree remained CLEAN, free RAM recovered to ~4.72 GiB and D: free remained ~11.33 GiB. The script also scanned native processes before and after, verified zero orphan PostgreSQL processes, and rejected any retained database fixture. During the test, RAM dropped as low as ~2.02 GiB; the task monitored it and did not start a second concurrent repeat when the memory margin was limited.

## Actual source fix — prevent one round from being called repeated

On the exact parent version, the script emitted `BOSTAN_B105_NATIVE_WINDOWS_REAL_PG_PARALLEL_REPEATED_PASS rounds=1` even after only one parallel round. That receipt was misleading: three concurrent suites are not the same thing as two repeated rounds.

The existing final output block in `scripts/bostan-private-windows-pg-three-suite-repeat.ps1` now has an explicit conditional:

- `-Rounds 1`: `BOSTAN_B105_NATIVE_WINDOWS_REAL_PG_PARALLEL_SINGLE_ROUND_PASS`
- `-Rounds 2`: retains `BOSTAN_B105_NATIVE_WINDOWS_REAL_PG_PARALLEL_REPEATED_PASS rounds=2`

No native PostgreSQL process handling, admission policy, worker count, cleanup, result validation or production application code changed.

**Native Windows PowerShell source test at new commit `f4d7addf926b9c6f833db07fd030193a546e1eea`:** parsed the entire checked-in `.ps1` with the native `System.Management.Automation.Language.Parser` and **zero syntax errors**. Extracted the single constrained receipt-only IfStatement AST, verified its exact permitted `Write-Output` statements, and evaluated that exact source branch with `$Rounds=1` and `$Rounds=2`. Both outputs matched their separate expected strings (**2/2 PASS**). This is native source-branch logic testing, **not a second real 136-second database run** after the receipt-only patch.

## Restoration / scope

The owned B177 TEMP was verified to contain ONLY the one marker created by this task; exact regular-file marker bytes were checked and removed, then the empty owned directory alone was removed **without recursive cleanup**. Returned the existing B177 QA worktree to its original detached SHA `e02229502d664a3594174886752e794a3a43edaf`, restored original sparse scope `packages/db`, verified Git CLEAN, B177-temp ABSENT, and zero postgres.exe processes. No foreign databases, processes, files or global caches were changed.

This is one genuine native Windows three-suite parallel PostgreSQL pass, and is **NOT** two repeats, a kill/forced-crash test, or proof of adversarial `io_worker` teardown. Issue #234 therefore REMAINS OPEN. The Windows compiled/runtime/Chromium issue #237, full TS7/root Vitest, genuine Linux bwrap, installed multi-OS app, tenant/side-effect consent, provenance remain RELEASE NO-GO. Do not merge, publish, deploy, enable Actions, spend money or process customer data.
