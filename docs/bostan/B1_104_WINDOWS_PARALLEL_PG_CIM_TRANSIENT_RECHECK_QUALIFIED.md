# B1-104 — Bounded CIM reinspection restores native Windows parallel real-PostgreSQL migration QA

Date: 2026-10-31 Asia/Riyadh. STRICT PRIVATE, ZERO COST, NONPUBLISHING. Stacked on B1-103 Draft PR #359 at exact parent `127de94cb8e4f812733acfec852caa28967ff071`.

## RED-before-GREEN test and minimal production change

The original B1-103 **native Windows two-worker** PostgreSQL test was RED: 1 PASS / 1 FAIL after `inspectVerifiedPostgresProcesses()` refused an ambiguous CIM process snapshot while stopping the real PG fixture in `status-card-migrations`. The failed run safely retained its suspect data directory (B191 TEMP); 0 PostgreSQL processes remained. Such a result must never be called qualified. Exact failing CIM field values from the original test were not collected, so a transient null process field is a hypothesis, NOT an observed root-cause value.

Added three focused test-only regression cases to `packages/db/src/windows-embedded-postgres-stop.test.ts` simulating:
1. One CIM snapshot with null `ExecutablePath`, followed by an unambiguous pinned postmaster process. A shutdown may occur only **after** the complete, matching subsequent process snapshot and unchanged postmaster PID marker; then two clean poststop snapshots.
2. One null `CreationDate` snapshot while no PID marker is present, followed by two separate empty clean snapshots; no `pg_ctl` is ever authorized.
3. Permanently null `ExecutablePath` over the retry cap: must fail closed, call **no shutdown**, and preserve the fixture marker.

**Mac RED-before-source-change** at commit `689909afcd7ee1ffc0cc894aa40a2b114270348b`: all **3 new tests RED**. Existing code rejected incomplete snapshots after one observation.

**Fixed code** at commit `adde80cea2c88f428eac926c4979c2c000333fa9`: in `packages/db/src/windows-embedded-postgres-stop.ts`, retry **only** incomplete CIM snapshots whose PID/parent identity is positive, integral, nonduplicate, and whose other nonnull identity fields are fully valid. At most **4** CIM inspections separated by up to **3 × 125 ms** pauses. A non-array, malformed executable path, invalid timestamp, duplicate PID, unknown PID, foreign binary, inspector error, or persistently ambiguous snapshot still fails closed; no `pg_ctl` is issued based on an incomplete snapshot. This change does **not** weaken the pinned PostgreSQL binary, ownership marker, PID, calendar date, process-path validation, read-after-check or two-clean-snapshot requirements. No package changes, production database or customer data.

## Native tests at the fixed source SHA

- **Mac Node26 / Vitest5** entire `windows-embedded-postgres-stop.test.ts` test file: **54 PASS, 1 OS-specific SKIP, EXIT 0**. All three previously RED regressions now green.
- **Native Windows 11 Node24.19 / Vitest5** same entire test file at exact `adde80ce` in independently owned `D:\Bostan-B192-qa`: **49 PASS, 6 OS-specific SKIP, EXIT 0**.
- **Mac TypeScript7 targeted strict noEmit** on `src/windows-embedded-postgres-stop.ts`: **EXIT 0** (NodeNext, ES2023, strict). This is targeted, not full monorepo typecheck.

## ACTUAL native Windows parallel two-suite PostgreSQL qualification — GREEN

Existing B1-104 Windows worktree at exact code SHA `adde80cea2c88f428eac926c4979c2c000333fa9`, matching owner-marked `D:\Bostan-B192-temp`, existing installed dependencies reused via owned junctions, no downloads/installs, no cloud/model calls, no customer data. Admission: **4.20 GiB free RAM**, **11.59 GiB D: free**, no prior PostgreSQL and zero preexisting fixture directories. Fresh PostgreSQL templates disabled. Invoked at `packages/db`:

```powershell
$env:TEMP='D:\Bostan-B192-temp'
$env:TMP=$env:TEMP
$env:PAPERCLIP_TEST_POSTGRES_TEMPLATE='0'
$env:NODE_OPTIONS='--max-old-space-size=1152'
.\node_modules\.bin\vitest.cmd run src/session-goal-migration.test.ts src/status-card-migrations.test.ts --pool=forks --maxWorkers=2 --testTimeout=90000 --hookTimeout=90000 --reporter=dot --silent
```

**Genuine native Windows real PostgreSQL migration tests**, **two separate real suites in TWO simultaneous Vitest fork workers**: **2 test files PASS, 2 tests PASS, 0 skips, Vitest EXIT 0, duration 51.53s**, entire QA command exited **0** in 54.88s. Postrun independent native `bostan-native-windows-postgres-no-orphans.ps1 -Run`: `BOSTAN_WINDOWS_PG_OWNED_PROCESSES=0`, `BOSTAN_WINDOWS_PG_UNINSPECTABLE=0`, `BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS`, scanner EXIT 0. Independently inspected all `postgres.exe`: **zero**. Retained migration directory count **0 before / 0 after**. Exact B192 tracked source clean.

This is **the first actually GREEN parallel multi-suite real-Postgres native Windows receipt** for the #234 scenario after earlier RED; not merely an isolated PG restart or two sequential suites. It validates this narrow pair of concurrent migration suites and teardown, not general stress, every database suite, or end-user installed packaging.

A second independent repeat was attempted **but refused before starting**, because available RAM dipped below strict 4 GiB admission. Do NOT claim two GREEN runs, change the threshold or force additional work on a busy user host. Previous B191/B144 failed-test owner-marked data fixtures remain untouched; no global cleanup, process killing or weakening of quiescence.

## Unqualified production release gates

#234 multi-suite behavior is **narrowly proven in this pair**, but broader repeated/stressed and crash scenarios require further evidence; do not claim the full release or all possible PG lifecycles qualified. Full Bostan RELEASE **NO-GO**: installed Windows/macOS/Linux product and installers, long-duration/multi-suite stress, governance of true offline agents and explicit untrusted effects consent/sandbox, complete security/privacy, original license/NOTICE/provenance audit, and independent cross-platform checks remain open. PR stays PRIVATE DRAFT, no main merge, Actions, publish/deploy/release/npm pack, paid inference or unowned cleanup.
