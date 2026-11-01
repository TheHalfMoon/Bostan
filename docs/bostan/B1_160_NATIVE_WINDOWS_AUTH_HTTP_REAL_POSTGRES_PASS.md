# B1-160 — Real native Windows authenticated source server + PostgreSQL qualification

**Status: PRIVATE / DRAFT / UNMERGED / ZERO COST / RELEASE NO-GO.** Verified 2026-11-01, Asia/Riyadh.

## Exact target and isolation

Direct parent is B1-159 private Draft PR #416 at **85b1c750989a852d7dfe7f5551178b58b32367e4**. An already existing **clean**, fully materialized Windows 11 private QA checkout (owned B111 QA wave) was temporarily checked out **detached** at that exact source SHA; no user production services or databases were used. Its sibling owned B111 TEMP directory was already available, non-reparse, and configured only in the test terminal session. No new clone, dependency install, CI workflow, paid provider or deployment.

Native test machine: **Node v24.19.0**, pnpm v9.12.0; the *source-mode* app uses the existing installed tsx loader. The Windows resource admission returned:

- Memory **PASS**, ~15.72 GiB total / **6.69 GiB free**, minimum 6 GiB total and 2 GiB free.
- Disk **PASS**, ~18.03 GiB free on the system drive (minimum 2 GiB), ~11.54 GiB free on workspace and owned TEMP volume (minimum 6 GiB).
- Before launch: read-only Windows process inspection showed **0 postgres.exe** processes.

No Chromium or compiled server assets were present in the source QA checkout, so this was intentionally the **source server** live HTTP mode, not compiled/browser mode.

## Exact native execution

From the full private repo root, with a session-local TEMP/TMP pointing to its previously owned B111 test TEMP directory:

~~~powershell
node scripts/bostan-private-windows-memory-admission.mjs --check
node scripts/bostan-private-windows-disk-admission.mjs --check
node scripts/bostan-private-windows-live-http.mjs --plan
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-live-http.mjs --run
~~~

**Resource checks and plan returned exit 0.** An initial invocation using Windows-style backslashes in the Node ESM --import loader specifier failed immediately with ERR_INVALID_MODULE_SPECIFIER **before** the fixture/database was created; correcting only the command-line path to forward slashes produced the actual successful run above. No product source or guard code was bypassed.

The real source-mode Windows script executed for **161.55 seconds**, returned **BOSTAN_LIVE_HTTP_EXIT=0**, and emitted its explicit authenticated HTTP evidence:

- **BOSTAN_WINDOWS_LIVE_POSTGRES_MIGRATED:** real ephemeral embedded PostgreSQL startup and schema migration.
- **BOSTAN_WINDOWS_LIVE_HTTP_AUTH_HEALTH_PASS:** actual loopback server health passed in authenticated/private bootstrap-pending state; final evidence reports HTTP **200**.
- **BOSTAN_WINDOWS_LIVE_AUTH_SIGNUP_PASS** and **BOSTAN_WINDOWS_LIVE_SIGNED_IN_SESSION_PASS:** real synthetic Better Auth sign-up and session against migrated PostgreSQL.
- **BOSTAN_WINDOWS_LIVE_ANONYMOUS_CLAIM_DENIED**: unauthenticated bootstrap claim refused.
- **BOSTAN_WINDOWS_LIVE_CROSS_ORIGIN_CLAIM_DENIED**, **SPOOFED_REFERER_CLAIM_DENIED**, **CROSS_SCHEME_CLAIM_DENIED**, **NONCANONICAL_ORIGIN_DENIED**, **MISSING_ORIGIN_CLAIM_DENIED**, and **DENIALS_PRESERVE_PENDING**: the negative-origin and CSRF-adjacent checks passed without mutating pending claim state.
- **BOSTAN_WINDOWS_LIVE_FIRST_ADMIN_CLAIM_PASS**, **REPEAT_CLAIM_DENIED**, **POST_CLAIM_HEALTH_PASS**: first admin claim granted once, repeated claim refused, authenticated health stayed valid.
- **BOSTAN_WINDOWS_LIVE_SERVER_CLOSED**, **POSTGRES_CLEANED**, **NO_POSTGRES_ORPHANS_PASS**, **OWNED_FIXTURE_CLEANED**: graceful owned teardown passed.

The final machine-evaluated JSON reported:

~~~json
{
  "schema": "bostan.private-windows-http-evidence.v1",
  "run": true,
  "releaseQualified": false,
  "localhostOnly": true,
  "usesRealDatabase": true,
  "usesRealHttpServer": true,
  "windowsAuthenticatedHttpQualified": true,
  "outcome": "pass",
  "childClosed": true,
  "postgresCleaned": true,
  "ownedFixtureCleaned": true,
  "noOrphanPostgresProcessVerified": true,
  "livePostgres": true,
  "realHttpStatus": 200,
  "realSession": true,
  "firstAdmin": true,
  "authenticatedBrowserQualified": false,
  "authenticatedMembersBrowserQualified": false,
  "realSharedPostgresConcurrentWritesQualified": false
}
~~~

A second, independent **read-only** Windows observation *after* exit verified **0 postgres.exe processes**, **0 remaining owned B111 auth HTTP fixture directories**, and **clean Git status** at the exact QA commit. Free memory recovered to ~6.62 GiB; no persisted data was created outside the previously owned QA directory.

## What this satisfies and what remains

This is the **first source-native full Windows authenticated/private HTTP+real PostgreSQL+synthetic signup/session/first-admin and teardown PASS** on the current Bostan private PR stack. It resolves a substantial **source-server** subgate of Windows issue #237 and provides **one actual real PostgreSQL zero-orphan receipt** relevant to issue #234.

It is **NOT** a compiled Windows server run, installed/package browser run, real Chromium UI session, membership/role/tenant end-to-end exercise, a repeated/forced-crash io_worker stress qualification, or a production deployment. The QA checkout **did not contain** the SHA-owned compiled runtime, built UI assets or local Playwright browser binaries, so those missing gates were not simulated or marked green.

**Still release-blocking:**
1. #237: compiled Windows binary/runtime ownership and genuine authenticated Chromium browser/role/tenant tests.
2. #234: repeated multi-suite forced-crash/kill native PostgreSQL teardown stress proving zero *owned* orphan io_worker processes each time; one successful graceful run is not a stress qualification.
3. Full TypeScript7 server/root qualification (resource-limited earlier attempt aborted); full Vitest, Linux unprivileged bwrap, installed macOS/Windows/Linux journeys, agent consent/side-effects, tenant authorization, and legal LICENSE/NOTICE/provenance review.

Keep **PRIVATE DRAFT, UNMERGED, UNPUBLISHED, NO-GO**. Do not delete other users' files or processes, enable Actions, deploy, publish npm/docs, access customer data, or spend money.
