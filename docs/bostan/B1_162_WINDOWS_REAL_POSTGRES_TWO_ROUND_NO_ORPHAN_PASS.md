# B1-162 — Two real Windows PostgreSQL teardown/no-orphan cycles

**2026-11-01 Asia/Riyadh | PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO.**

Direct parent #418 exact source Git SHA **931d5a4839dd5af98aab4df4b1bef0768dff0383**. Actual native Windows 11 Node24.19.0 execution from previously existing clean full B111 private QA checkout, temporarily detached at exact SHA. No customer/production data, paid provider, CI Actions or deployment.

## Preflight / ownership

- Verified Git HEAD exact parent and clean status; pre-run Windows CIM PostgreSQL process count **0**.
- Verified existing B111-temp is an ordinary owned matching QA directory. Its needed ownership marker was missing; the task created only a new 17-byte regular BOSTAN_QA_OWNED file containing BOSTAN_TEST_ONLY plus newline. Existing unrelated TEMP entries were not modified.
- Actual script --plan returned exit0 with run:false. Memory admission PASS (15.72 GiB total, **6.56 GiB free**; minima 6/2 GiB); disk admission PASS (system 17.91 GiB vs minimum2, workspace/owned TEMP **7.67 GiB vs minimum6**).

## Genuine native test execution and outcome

Command run from the exact source checkout with session-local TEMP/TMP set to the previously owned matching B111-temp:

~~~powershell
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-postgres-teardown-qa.mjs --run-two
~~~

**PASS, EXIT 0, 75.36 seconds.** Exactly **two successive independent real migrated PostgreSQL cluster cycles** (no HTTP server), each with its own owned temporary database, clean stop, directory cleanup and read-only native no-orphans check. The second started only after a new verified pre-run zero-process check.

~~~text
BOSTAN_WIN_PG_PREEXISTING_ZERO_VERIFIED
BOSTAN_WIN_PG_REAL_MIGRATION_PASS
BOSTAN_WIN_PG_CLEANUP_METHOD_PASS=true
BOSTAN_WIN_PG_NO_ORPHANS=true
BOSTAN_WIN_PG_ROUND_1_OWNED_STOP_AND_ORPHAN_PASS
BOSTAN_WIN_PG_PREEXISTING_ZERO_VERIFIED
BOSTAN_WIN_PG_REAL_MIGRATION_PASS
BOSTAN_WIN_PG_CLEANUP_METHOD_PASS=true
BOSTAN_WIN_PG_NO_ORPHANS=true
BOSTAN_WIN_PG_ROUND_2_OWNED_STOP_AND_ORPHAN_PASS
BOSTAN_WINDOWS_REAL_POSTGRES_TWO_ROUND_TEARDOWN_QUALIFIED
BOSTAN_PG_TWO_ROUND_EXIT=0
~~~

Machine-evaluated schema bostan.private-windows-real-postgres-teardown.v1: run=true, postgresCycles=2, postgresMigrationsPassed=true, ownedCleanup=true, noOrphanPostgresProcessVerified=true, fullWindowsHttpQualified=false, releaseQualified=false.

## Independent post-run read-only confirmation

- Windows postgres.exe process count **0**.
- Matching owned B111 temporary database data directories **0**.
- Git exact SHA still verified, worktree CLEAN.
- Free memory recovered to ~6.71 GiB; D: free ~7.14 GiB.
- Existing unrelated TEMP contents were preserved. AppData appeared, with ownership uncertain, and was not deleted. After the native run, the task verified its own marker as a regular non-reparse file with EXACT 17-byte BOSTAN_TEST_ONLY plus LF contents and removed ONLY THAT marker; original TEMP entries were left untouched. The clean full QA checkout was restored to its exact original detached SHA 4a367c57e4a40c06dad2befd7de5a6ff43bd6081. Independent final read-only checks confirmed Git CLEAN, the marker ABSENT, zero postgres.exe processes, and the three remaining unrelated/uncertain TEMP entries preserved.

## Strict qualification limits

Two real graceful rounds substantially strengthen the single actual Windows PostgreSQL teardown evidence in #417. **They DO NOT prove forced-crash, multi-Vitest-suite, worker adversarial teardown or repeated abort behavior. Issue #234 remains OPEN.** #237 remains OPEN for SHA-owned compiled Windows server and Chromium/browser roles/tenant journeys (real source HTTP/BetterAuth already PASS under #417). Full root TypeScript7/Vitest, Linux rootless bwrap, installed three-OS journeys, side-effect consent/tenant isolation, LICENSE/NOTICE/provenance remain NO-GO.

PRIVATE DRAFT only; no main merge, release, publication, deployment, GitHub Actions, paid services, customer data or foreign process/file cleanup.
