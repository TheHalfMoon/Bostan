# B1-47 — Native Windows two independent real PostgreSQL migrations and clean stops

Date: 2026-10-29. Strictly PRIVATE, zero cost, NONPUBLISHING. Exact parent B1-46 Draft #300 at `60927432efb0a346af6dad68bf8ac04462dc39fb`.

## What was changed

Extended the existing strictly private test-only `scripts/bostan-private-windows-postgres-teardown-qa.mjs` to accept an **explicit** `--run-two` mode. It still requires native Windows, exact owned matching B### QA checkout/TEMP, exact outer ownership marker, no managed/cloud settings, free disk/memory, and actual read-only native process scan. Without `--run` or `--run-two`, the tool remains an inert plan. No production application code changed.

Each round:
1. Independently checks that **zero** PostgreSQL processes exist. Refuses a foreign/unattributed/uninspectable process without attempting to stop anything.
2. Initializes **fresh** local embedded PostgreSQL (no template cache), creates actual database and runs real migrations using the unchanged pinned helper.
3. Calls the existing real owned `db.cleanup()`.
4. Runs the strict independent read-only native Windows PostgreSQL orphan checker. Any failure fails closed and prevents starting a subsequent round. No directory is removed except by the existing exact owner-aware helper.

## Actual native Windows evidence — TWO rounds

Authorized Windows 11 computer `Abdulaziz`. Source tested at exact `4fbcad01f3fd78d568ff3df929dd8deab5cffd20` in previously admitted isolated `D:\Bostan-B144-qa` and matching owned TEMP `D:\Bostan-B144-temp`. Used only local, free PostgreSQL and synthetic migrated database; no Bostan app server, cloud provider, model or customer data.

Executed:

```powershell
$env:TEMP = 'D:\Bostan-B144-temp'
$env:TMP = $env:TEMP
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-postgres-teardown-qa.mjs --run-two
```

**REAL exit 0 in 63.70s**, with exact receipts:

```text
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
B147_NATIVE_MULTI_PG_EXIT=0
```

JSON receipt: `postgresCycles:2`, `postgresMigrationsPassed:true`, `ownedCleanup:true`, `noOrphanPostgresProcessVerified:true`, `fullWindowsHttpQualified:false`, `releaseQualified:false`.

Independent read-only post-run Windows verification: **0 postgres.exe**, **0 B144-owned node.exe** and no remaining test-owned PG cluster directories in B144 TEMP; only pre-existing AppData/tsx-Shehr caches remained and were left untouched. D free **8.76 GiB**. Previous B1-46 full real packed Bostan + Better Auth + PostgreSQL HTTP had also passed all existing authenticated backend stages separately (62.96s); this B1-47 mode deliberately does not re-run that server.

## Boundaries and next gates — release NO-GO

Two consecutive real fresh PostgreSQL instances plus independent orphan checks are **not** equivalent to simultaneous multi-suite concurrency/stress, crash/power-loss recovery or native Windows installed app verification. The broader #234 orphan/stress gate needs its dedicated parallel/multi-suite suite, not an ungrounded closure claim. Also need Windows authenticated Chromium browser UI, zero-cost genuine local agent execution, installers/Linux, full TypeScript semantic typechecks, security/privacy/licensing/provenance.

Keep GitHub PRIVATE, stacked Draft only, protected main untouched; no Actions enable, paid models, publishing, release, deployment, npm pack, customer data or unrelated file/process deletions.
