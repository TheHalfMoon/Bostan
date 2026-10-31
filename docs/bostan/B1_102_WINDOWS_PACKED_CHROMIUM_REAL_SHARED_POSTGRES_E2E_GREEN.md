# B1-102 — Native Windows packed backend, Chromium Members and same-PostgreSQL 12-write E2E GREEN

Date: 2026-10-31 Asia/Riyadh. PRIVATE, ZERO COST, NONPUBLISHING. Evidence-only record; no product code or release claim.
Actual native source checkout: `9a5ac47aac78e1107ddfded01d36762c871a6e8a` (B1-100 source on Draft #357). This document is stacked on the later B1-100 documentation tip; source version under test remains exactly `9a5ac47a`.
Earlier Windows B1-60 failure `docs/bostan/B1_60_WINDOWS_SHARED_POSTGRES_MEMBERS_CONCURRENT_E2E_RED.md` stopped at static import; B1-102 objectively reran that exact stronger opt-in test mode.

## Admission, reproducible invocation, and mistakes caught

Native Windows 11, Node v24.19.0, independent QA worktree `D:\Bostan-B144-qa` and matching owned TEMP `D:\Bostan-B144-temp`. Preflight: ~4.8 GiB free physical RAM, C: ~3.65 GiB and D: ~11.72 GiB free; project's 2 GiB RAM / 2 GiB system disk / 6 GiB workspace+TEMP thresholds passed. Existing pinned SHA256-owned runtime, built UI, local Chromium assets, embedded Windows PostgreSQL and installed dependencies were reused; no installs or customer data.

Use the explicitly documented TSX import loader **and** browser asset root; omitting either is NOT a PostgreSQL or Bostan product failure. These exact PowerShell assignments apply only to the child session, not global user/system settings:

```powershell
Set-Location 'D:\Bostan-B144-qa'
$env:TEMP='D:\Bostan-B144-temp'
$env:TMP=$env:TEMP
$env:PLAYWRIGHT_BROWSERS_PATH='D:\Bostan-B144-qa\.qa-playwright-browsers'
node --import './server/node_modules/tsx/dist/loader.mjs' './scripts/bostan-private-windows-live-http.mjs' --run-compiled-browser-members-concurrent
```

Do not replace the forward-slash `./` ESM specifier with PowerShell's `.\` import form: Node rejects it as ERR_INVALID_MODULE_SPECIFIER. Missing `PLAYWRIGHT_BROWSERS_PATH` causes pre-fixture Chromium asset refusal; launching without the TSX loader results in an early, unqualified test-helper import failure. A prior incomplete invocation created one marker-owned failed-attempt fixture. It is **retained for explicit inspection** rather than deleted: `D:\Bostan-B144-temp\bostan-private-auth-http-Wr3kOZ`. Do not call that fixture a leftover from the later successful run or remove it by generalized cleanup.

A separate bounded no-real-Postgres packed import trace also verified 77 module loads and 77 evaluations complete, no unmatched module evaluations; its intentionally rejecting local DB stub caused expected ECONNRESET and nonzero diagnostic exit. That trace is NOT a production startup pass.

## Actual native full E2E receipt — 141.13 seconds, EXIT 0

The full opt-in native run produced all mandatory receipts:
- `BOSTAN_WINDOWS_CHROMIUM_ASSET_PREFLIGHT_PASS`
- `BOSTAN_WINDOWS_LIVE_POSTGRES_MIGRATED` — real fresh isolated PostgreSQL started and migrations applied
- `BOSTAN_WINDOWS_LIVE_SERVER_MODE=compiled`
- `BOSTAN_WINDOWS_LIVE_HTTP_AUTH_HEALTH_PASS`
- `BOSTAN_WINDOWS_LIVE_ANONYMOUS_CLAIM_DENIED`
- `BOSTAN_WINDOWS_CHROMIUM_SIGNUP_PASS`; actual Better Auth signup/session passed
- All original origin/referrer/scheme/noncanonical/missing-origin denials and first-admin claim/replay-denial/post-claim health passed
- Native Chromium Members real invite, third session acceptance, viewer write denial, operator promotion with allowed write, member suspension with revoked write
- `BOSTAN_WINDOWS_REAL_SHARED_POSTGRES_12_CONCURRENT_WRITES_PASS` — 12 overlapping authenticated HTTP issue writes into **one** actual PostgreSQL, distinct record identities and correct company ownership, two company-scoped readbacks, cross-company denial
- `BOSTAN_WINDOWS_CHROMIUM_MEMBERS_INVITE_ROLE_SUSPEND_PASS`
- `BOSTAN_WINDOWS_LIVE_SERVER_CLOSED`
- `BOSTAN_WINDOWS_LIVE_POSTGRES_CLEANED`
- `BOSTAN_WINDOWS_LIVE_NO_POSTGRES_ORPHANS_PASS`
- `BOSTAN_WINDOWS_LIVE_OWNED_FIXTURE_CLEANED`

Exact structured final result: `outcome:"pass"`, `windowsAuthenticatedHttpQualified:true`, `authenticatedBrowserQualified:true`, `authenticatedMembersBrowserQualified:true`, `realSharedPostgresConcurrentWritesQualified:true`, `livePostgres:true`, `realHttpStatus:200`, `realSession:true`, `firstAdmin:true`, `childClosed:true`, `postgresCleaned:true`, `ownedFixtureCleaned:true`, `noOrphanPostgresProcessVerified:true`, `releaseQualified:false`, `publishes:false`. All mandatory ordered stages in the proof were true. No manual stage overrides, faked real DB or paid provider calls.

## Independent after-run safety check

Native Windows read-only process scan showed 0 `postgres.exe`, 0 B144-owned `node.exe`, and 0 B144-owned `chrome.exe`/`headless_shell.exe`. The successful run's own fixture was removed by its verified teardown. The **separate earlier failed-attempt marker-owned directory** remained (one), deliberately untouched. B144 tracked Git sources remained unchanged; only existing local browser assets are untracked.

## What this DOES NOT qualify

This is the successfully verified source-QA **compiled runtime**, not an end-user installed Windows product or proof that its packed artifact was rebuilt from the exact latest source commit. Do not substitute it for native Windows installer, production deployed package, Linux/macOS installers, genuine offline model/agent governance, untrusted agent sandbox and explicit effects consent, #234 multi-suite PG orphan and shared-row high-load stress, long-running concurrency/deadlock tests, full production security/privacy, original source licenses/NOTICE/provenance, or final release acceptance. Concurrent PR #356 (B1-101 HTTP nonsettling abort) was NOT included in this Windows tested source checkout. Full product RELEASE **NO-GO**.

Main was last observed at `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a`, `protected:false`. Private-repository GitHub ruleset/branch-protection REST APIs returned HTTP 403 with an upgrade requirement; do not make the repo public or purchase a plan to bypass zero-cost constraints.

Keep this as a PRIVATE stacked DRAFT only, no main merge, GitHub Actions enabling, publish/deploy/release/npm pack, paid model/cloud, customer data or foreign-process termination.
