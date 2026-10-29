# B1-46 — Native Windows real PostgreSQL migration and single-suite owned teardown

Date: 2026-10-29. PRIVATE, zero cost, NONPUBLISHING. Exact stacked parent Draft #299 HEAD `74ca80d1fe09bbec50aaf4249079cee777ba9be0`.

## Why

Native Windows B1-39 / #237 had a real PostgreSQL-migrated compiled-server 180s HTTP failure, followed by inconclusive PostgreSQL shutdown and a stale `postmaster.pid`. Read-only scans after that old incident found zero live PostgreSQL processes but could not prove the original cleanup step. Before another expensive full app test, qualify a **real DB-only migration and teardown** using the unchanged embedded-Postgres library, without a live app server.

## Implemented

New explicit opt-in `scripts/bostan-private-windows-postgres-teardown-qa.mjs --run`:

- Requires native Windows, matching `Bostan-B###-qa` checkout and `Bostan-B###-temp`, regular exact `BOSTAN_TEST_ONLY` outer marker, private repo identity, no managed/cloud variables, real disk/memory admission.
- **Before starting PostgreSQL**, runs the repository's pinned read-only native Windows process-tree checker; refuses if ANY pre-existing postgres process is owned, unattributed or uninspectable. It never kills a foreign process.
- Starts an actual isolated localhost embedded PostgreSQL via the pinned existing `startEmbeddedPostgresTestDatabase` (fresh startup, real migration), explicitly disables persistent template reuse, then calls the helper's exact own cleanup. The native helper uses the existing `pg_ctl -D ... -m fast -w -t 40 stop` and preserves uncertain fixtures instead of deleting them.
- After shutdown, runs the independent strict read-only PowerShell orphan checker again. Only returns green if **both** `db.cleanup()` and the zero-postgres-process proof succeed. It does not attempt risky recovery of old stale-PID directories; no app server, real account, browser or model is started.
- Default `--plan` is inert.

## ACTUALLY executed native Windows

Authorized Windows device `Abdulaziz`, isolated previously admitted `D:\Bostan-B144-qa` at exact commit `b784cb19229aaa3b59a2fc4105d9f2690440047b`, with owned `D:\Bostan-B144-temp`. Ran real command:

```powershell
$env:TEMP = 'D:\Bostan-B144-temp'
$env:TMP = $env:TEMP
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-postgres-teardown-qa.mjs --run
```

**EXIT 0 in 44.20 seconds** with these actual receipts:

```text
BOSTAN_WIN_PG_PREEXISTING_ZERO_VERIFIED
BOSTAN_WIN_PG_REAL_MIGRATION_PASS
BOSTAN_WIN_PG_CLEANUP_METHOD_PASS=true
BOSTAN_WIN_PG_NO_ORPHANS=true
BOSTAN_WINDOWS_REAL_POSTGRES_SINGLE_SUITE_TEARDOWN_QUALIFIED
B146_NATIVE_PG_TEARDOWN_EXIT=0
```

Post-run independent read-only `Get-Process postgres`: **0**. Script did not start/stop other services or run Bostan HTTP. The owned outer test temp retained its original marker plus independently generated `tsx-Shehr`/AppData caches; no deletion of unknown files was attempted.

## Still NO-GO

This proves only **one** successful native Windows fresh cluster migration/cleanup. It does NOT close #234 multiple-suite orphan qualification, Windows compiled Bostan server 18-stage authenticated HTTP #237, full Windows UI/Chromium, real free offline agent, Linux/installers, semantic typecheck or legal/security/privacy checks. Before any 180s full test require fresh resource and process preflight plus fail-closed cleanup. No `main` merge, Actions activation, publish, npm pack, paid model, data import or release.
