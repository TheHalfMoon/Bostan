# B1-105 — Fail-closed native Windows repeatable three-suite PostgreSQL QA

Date: 2026-10-31, Asia/Riyadh. Strictly PRIVATE, ZERO-COST, NONPUBLISHING. Parent B1-104 Draft #360, exact parent `4e0a834db6cc26d50f03ddf456c02962274df182`. This is a QA runner, **not** a new production-feature or installer release.

## Source contribution and fail-closed contract

New `scripts/bostan-private-windows-pg-three-suite-repeat.ps1` (initial runner code commit `e64abb3b7582b0452d2352004b7f12e4b8e441e4`, subsequent output-only safe diagnostic update `fa35a10533ea68028a7e53d926a990e8290a5e82`).

- Inert by default: without `-Run` prints a plan and exits 0; only explicit `-Run` can start actual PostgreSQL work; 1–2 rounds.
- Native Windows only; exactly matched `Bostan-B<id>-qa` worktree and `Bostan-B<id>-temp` with ordinary-file marker equal to `BOSTAN_TEST_ONLY`, non-junction TEMP, private `bostan` package identity; no managed-cloud env.
- Each round refuses any pre-existing PostgreSQL process, retained fixture directory, available system C: less than 2 GiB, workspace D: less than 8 GiB, free RAM less than 4 GiB, missing installed local test dependencies or independent read-only no-orphans scan refusal. Does not install dependencies.
- Runs **three distinct, real embedded-PostgreSQL migration and authorization suites** under Vitest5, two simultaneous fork workers: `session-goal-migration.test.ts`, `status-card-migrations.test.ts`, and `chat-tenant-foreign-keys.test.ts`. Each suite uses its own genuine ephemeral database; templates disabled; 90s bound. Captures only bounded pass/fail status in output, not test SQL/logs/credentials.
- Demands exact **3 test files PASS and 3 tests PASS** without skip, process exit 0, independent zero-owned/uninspectable PostgreSQL scanner and **zero retained directories** after each round before granting PASS or starting next round.
- On *any* error/admission refusal returns nonzero, emits bounded redacted diagnostic; never invokes Stop-Process, cleans a retained database, touches unrelated programs, or claims release qualification.

### Native Windows 11 actual green first round

Correct pinned B1-105 initial script SHA `e64abb3b7582b0452d2352004b7f12e4b8e441e4` fetched to separately-owned `D:\Bostan-B193-qa` at exact source. Matching newly owned `D:\Bostan-B193-temp` with marker, existing pinned node_modules reused through junctions; zero extra dependency downloads. Node 24.19 / Vitest 5.0.3. Admission before checkout: **4.85 GiB free RAM**, C: **3.59 GiB**, D: **11.85 GiB**, zero PostgreSQL processes.

Explicit `-Run -Rounds 2` started round 1. **Actual round 1 PASSED all 3 real suites, 3/3 tests, Vitest exit 0** with two concurrent fork workers. Actual receipt:

```text
BOSTAN_B105_POSTGRES_NO_ORPHANS_PASS
BOSTAN_B105_PARALLEL_ROUND_1_START
BOSTAN_B105_VITEST_EXIT=0
BOSTAN_B105_THREE_REAL_SUITES_PASS=True
BOSTAN_B105_POSTGRES_NO_ORPHANS_PASS
BOSTAN_B105_ROUND_1_GREEN_NO_RETAINED_FIXTURES
```

The native *overall* two-round invocation returned **EXIT 1** in **103.64 seconds** because round 2 refused admission after resource pressure; do NOT relabel the command as fully green. Independent read-only postrun: **0 postgres.exe**, **0 B193 fixture directories**, **0 tracked QA source changes**. Available RAM shortly afterward **2.18 GiB**, C: **3.54 GiB**, D: **11.66 GiB**. Both postgres and fixtures were cleaned by genuine, passing suite's own cleanup; harness never deleted them.

### Subsequent bounded diagnostic regression

At updated output-only code SHA `fa35a10533ea68028a7e53d926a990e8290a5e82`, rechecked on same native B193 QA when free RAM was **3.61 GiB**. Plan-only mode **EXIT 0**, no DB started. Explicit `-Run -Rounds 2` immediately emitted `BOSTAN_B105_RESOURCE_ADMISSION_REFUSED`, `BOSTAN_B105_FAIL_CLOSED`, and **EXIT 1**, with independently confirmed zero PG and zero new fixture directories. Thus the tested retry/admission diagnostics do not expose arbitrary local errors and never misstate refusal as a successful test run.

### Limitations and next release gates

**Only one round of three parallel real PG suites is GREEN; a second independent round is NOT executed.** The resulting first-round good behavior extends B1-104's previous 2-suite 2-worker green, but multi-round sustained stress, crash/power-loss, all database suites, installed Windows packaged app and Linux are not qualified. Existing earlier B144/B191 failed-run owner-marked fixtures are intentionally untouched. Keep #234 OPEN pending repeated resource-admitted stress and crash scenarios. No modification to core Windows PostgreSQL stop safety guards in B1-105.

Full Bostan RELEASE **NO-GO**: real installed cross-platform app and installers; broader agent sandbox/effects consent; genuine offline governed multi-agent actions; more sustained multi-tenant load and reliability; security/privacy and original upstream license/NOTICE/provenance verification. PRIVATE repo, stacked DRAFT PRs, no main merge, Actions, npm pack, publish, deploy, releases, paid model/cloud or unowned deletion.
