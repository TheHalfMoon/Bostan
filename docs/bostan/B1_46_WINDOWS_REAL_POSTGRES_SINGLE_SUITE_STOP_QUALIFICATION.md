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

## **Additional real native Windows full packed backend acceptance — GREEN**

After the standalone 44.20s native PostgreSQL stop proof, ran the existing stricter and previously **RED** native Windows compiled-server acceptance at the exact pushed PR #300 head `7ccbf1476aec8825d9d399006396c79c41f75367`, same separate B144 owned worktree/TEMP:

```powershell
$env:TEMP = 'D:\Bostan-B144-temp'
$env:TMP = $env:TEMP
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-live-http.mjs --run-compiled
```

**REAL EXIT 0 in 62.96 seconds**, with actual SHA256-owned packed runtime, actual freshly migrated localhost PostgreSQL, and actual Better Auth HTTP traffic. All existing specified evidence stages passed:

- `BOSTAN_WINDOWS_LIVE_POSTGRES_MIGRATED`
- `BOSTAN_WINDOWS_LIVE_HTTP_AUTH_HEALTH_PASS` (actual HTTP 200, private authenticated bootstrap-pending health)
- `BOSTAN_WINDOWS_LIVE_ANONYMOUS_CLAIM_DENIED`
- `BOSTAN_WINDOWS_LIVE_AUTH_SIGNUP_PASS`
- `BOSTAN_WINDOWS_LIVE_SIGNED_IN_SESSION_PASS`
- `BOSTAN_WINDOWS_LIVE_CROSS_ORIGIN_CLAIM_DENIED`
- `BOSTAN_WINDOWS_LIVE_SPOOFED_REFERER_CLAIM_DENIED`
- `BOSTAN_WINDOWS_LIVE_CROSS_SCHEME_CLAIM_DENIED`
- `BOSTAN_WINDOWS_LIVE_NONCANONICAL_ORIGIN_DENIED`
- `BOSTAN_WINDOWS_LIVE_MISSING_ORIGIN_CLAIM_DENIED`
- `BOSTAN_WINDOWS_LIVE_DENIALS_PRESERVE_PENDING`
- `BOSTAN_WINDOWS_LIVE_FIRST_ADMIN_CLAIM_PASS`
- `BOSTAN_WINDOWS_LIVE_REPEAT_CLAIM_DENIED`
- `BOSTAN_WINDOWS_LIVE_POST_CLAIM_HEALTH_PASS`
- `BOSTAN_WINDOWS_LIVE_SERVER_CLOSED`
- `BOSTAN_WINDOWS_LIVE_POSTGRES_CLEANED`
- `BOSTAN_WINDOWS_LIVE_NO_POSTGRES_ORPHANS_PASS`
- `BOSTAN_WINDOWS_LIVE_OWNED_FIXTURE_CLEANED`

The final test evidence object recorded `"windowsAuthenticatedHttpQualified":true`, `"outcome":"pass"`, `"childClosed":true`, `"postgresCleaned":true`, `"ownedFixtureCleaned":true`, `"noOrphanPostgresProcessVerified":true`, `"realHttpStatus":200`, `"realSession":true`, `"firstAdmin":true`, `"releaseQualified":false`, `"authenticatedBrowserQualified":false`.

**Independent Windows read-only verification after the acceptance:** zero active `postgres.exe`, zero B144-owned Node processes, no owned `bostan-private-auth-http-*` scratch folders remaining. D drive approximately **8.76 GiB free**. The QA TEMP retained pre-existing AppData and `tsx-Shehr` cache; these are not the PG suite's owned scratch and were not deleted. No foreign process/file touched.

This resolves the **previously failing exact native Windows packed backend/real PG/Better Auth HTTP acceptance path** in this source+device environment; it is stronger than the standalone single-suite proof above. It does **not** prove a full native installed desktop browser flow, multi-suite PostgreSQL concurrency/stress, security sign-off, signed Windows package or public release readiness. Preserve fail-closed gate and `releaseQualified:false`.

## Still NO-GO

The single-suite PG helper passed, **and the previously red full native Windows compiled Bostan + real PG + authenticated HTTP acceptance now passed**. Still not qualified: #234 broader multi-suite orphan/stress gate, full Windows UI/Chromium, real free offline agent, Linux/installers, semantic typecheck or legal/security/privacy checks. Before any 180s full test require fresh resource and process preflight plus fail-closed cleanup. No `main` merge, Actions activation, publish, npm pack, paid model, data import or release.
