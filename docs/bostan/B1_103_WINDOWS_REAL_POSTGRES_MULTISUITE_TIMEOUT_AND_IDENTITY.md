# B1-103 — Native Windows multi-suite PostgreSQL fixture timeout qualification

Date: 2026-10-31 Asia/Riyadh. PRIVATE, ZERO-COST, NONPUBLISHING. Test-only code + exact source-backed evidence. Stacked parent Draft #358 head `44eddfc2a3a728b8444381485665f15ec0306369` (B1-102).

## Reproduced RED with the unchanged parent

Native Windows 11 Node v24.19.0, pinned Vitest v5.0.3, two actual real-PostgreSQL DB migration files in one invocation with **two fork workers** and fresh ephemeral PG clusters (template cache disabled):
- `packages/db/src/session-goal-migration.test.ts`
- `packages/db/src/status-card-migrations.test.ts`

Exact parent code at source commit `9a5ac47aac78e1107ddfded01d36762c871a6e8a`, in already-owned B144 QA checkout with matching `D:\Bostan-B144-temp`. `vitest run <two files> --pool=forks --maxWorkers=2 --testTimeout=90000 --hookTimeout=90000` produced **1 PASS / 1 FAIL, EXIT 1** (54.17s). The `session-goal-migration` test itself specified an overriding **30,000 ms** per-test timeout and expired during concurrent native PostgreSQL work. Its per-test override was *not* changed by the CLI-wide 90-second limit. Independent post-run scanner showed **0 postgres.exe, no orphan workers**, and EXIT 0. A `goal-migration-*` data directory from the timed-out test remains retained in B144 TEMP: **do not delete without independent ownership and quiescence proof**.

## Minimal test-only source repair

In `packages/db/src/session-goal-migration.test.ts`, replace the hardcoded `30_000` with the existing exported `EMBEDDED_POSTGRES_TEST_TIMEOUT_MS` (**90,000 ms**) from `test-embedded-postgres.ts`. This aligns the real DB test with the project's existing fixture budget; no production code, PostgreSQL shutdown security, process identity guard, migration SQL, authorization, dependencies, or package installers changed.

Commit under test: `983adf720cc1e1b081e96be9c1d27d1aee9e7e4f` on this B1-103 Draft branch.

## Stronger simultaneous-two-worker RED after the test timeout fix

Created a separate native Windows 11 worktree `D:\Bostan-B191-qa` from the exact B1-103 source commit, with matching newly-owned `D:\Bostan-B191-temp` marker `BOSTAN_TEST_ONLY`. Existing dependency tree reused through exact Windows junctions; no installation. Native two-worker Vitest actually started both real PG fixtures but returned **1 PASS / 1 FAIL, EXIT 1** in 46.24s: `status-card-migrations` failed during its own PG cleanup because the strict `inspectVerifiedPostgresProcesses` validator reported **Ambiguous Windows PostgreSQL process identity; retaining fixture** before authorizing `pg_ctl`. This is the existing fail-closed ownership contract under simultaneous processes, not a reason to remove the guard, kill unrelated PostgreSQL, or claim a parallel green. Independent post-run scanner showed **0 postgres.exe** with PASS; one `paperclip-status-card-migrations-*` directory was retained in B191 TEMP rather than deleted without verified ownership.

Issue #234's simultaneous multi-suite/worker teardown goal remains **OPEN / NOT QUALIFIED**.

## Actual GREEN: two distinct genuine DB suites, executed sequentially

On exact B1-103 Windows worktree commit `983adf7`, native Node 24.19.0, Vitest 5.0.3:

```powershell
$env:TEMP='D:\Bostan-B191-temp'
$env:TMP=$env:TEMP
$env:PAPERCLIP_TEST_POSTGRES_TEMPLATE='0'
$env:NODE_OPTIONS='--max-old-space-size=1152'
Set-Location 'D:\Bostan-B191-qa\packages\db'
.\node_modules\.bin\vitest.cmd run src/session-goal-migration.test.ts src/status-card-migrations.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism --hookTimeout=90000 --reporter=dot --silent
```

**2 test files PASS / 2 tests PASS / 0 SKIP / EXIT 0** in **84.90 seconds** (command process total 87.79 seconds). Both actually used native embedded PostgreSQL and migrations, not mocks. Independent native read-only `bostan-native-windows-postgres-no-orphans.ps1 -Run`: **0** owned PG processes, **0** uninspectable PG processes, `BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS`, scanner exit 0. Retained B191 status-card data-directory count was 1 **before** and 1 **after** this sequential green run: no new retained directories from the green run. An earlier failed parallel fixture remains deliberately retained and is NOT called cleaned.

**Mac regression:** exact same `983adf7` checkout, existing Node 26 + Vitest 5.0.3, two real PostgreSQL suites sequentially, template disabled, one capped-memory worker: **2/2 PASS, 0 SKIP, EXIT 0**, 8.68 seconds. Mac isolated QA worktree only, no paid models/data.

## Acceptance limitations and next actions

This resolves one real 30-second fixture test timeout and proves two **sequential** Windows/Mac DB suites can pass with zero postrun PostgreSQL processes; it does **not** prove simultaneous Windows multi-suite clean shutdown. The parallel case exposed a separate transient/malformed CIM process-identity snapshot refusal under concurrent PostgreSQL. Correct future fix must preserve pinned executable/PID/CreationDate validation, never call `pg_ctl` on an unverified process, never delete directories on ambiguous ownership, and prove parallel actual PG teardown + zero orphan and zero *new* retained fixtures. Do not close #234 based only on sequential evidence.

Full Bostan release **NO-GO**: genuine parallel multi-suite acceptance, Linux and actual installers, full installed Windows app, zero-cost governed agents, untrusted process effects sandbox/consent, sustained load, full security/privacy and source/license/NOTICE/provenance remain open. GitHub repo stays PRIVATE, change stays stacked **DRAFT**, no main merge, Actions enabling, publishing, deployment, release, npm pack, paid models/cloud, customer data or unowned local cleanup.
