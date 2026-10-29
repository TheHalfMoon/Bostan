# B1-49: Windows packed Chromium authentication — initial RED, final GREEN

2026-10-29. Stacked private Draft on #302, exact parent 720d2ecfa5b2a8bc8db0730cc17349685b589e5e.

Added a test-only opt-in --run-compiled-browser mode to the existing native Windows private HTTP harness. It checks local Chromium and built UI before creating a database, runs the actual SHA256-bundled backend with real isolated PostgreSQL, and intends to use existing browser signup and first-admin workflows. The backend-only modes remain unchanged. Extra memory admission protects the user device; the combined browser mode requires 4 GiB free before launch, and 3 GiB after migration.

Actual Windows test at f753756e15f0d1e920ff7ac1b8ab8ae8382ab479:
- The focused native Windows browser/environment tests passed 7/7.
- One initial run refused low free memory before PostgreSQL creation.
- A later run with 3.27 GiB free passed browser preflight and real PostgreSQL migration.
- The compiled server did not reach HTTP health before the 180-second deadline (178 probes); no browser signup or first-admin was attempted. Outcome RED, exit 1, 219.77 seconds total. The source of the delay is not yet proven.
- Cleanup was GOOD even on failure: owned child closed, PostgreSQL cleaned, independent no-orphans proof passed, owned disposable fixture cleaned. Independent post-run Windows scan found zero owned Node and zero postgres processes.

B1-46 backend-only Windows PG/Better Auth HTTP was independently GREEN; B1-48 Windows Chromium UI first paint was GREEN. The combined Windows browser-to-auth-server proof was RED in the earlier resource-constrained run; see final GREEN re-execution below. Do not infer cause merely from those differing results.

The new stricter preflight and corrected stale profiler-path assertions passed 26/26 focused Mac tests. These later edits require a new Windows run under sufficient free RAM; no such full run is claimed.

Release remains NO-GO. Still required: UI TypeScript checking, broader Windows authenticated member/invite UI, offline local agent, Linux/installers, multi-suite PG stress, and security/privacy/licensing reviews. No publish or protected-main merge.

## FINAL re-execution at the exact private Draft HEAD — GREEN

Authorized actual native Windows 11, SHA-owned B144 checkout at exact pushed source commit `6c8060949768c9ed8dbc38edad55919b16519a01`. After host free RAM recovered to at least 4 GiB, the new strict 4 GiB preflight and 3 GiB post-migration rule were admitted. The same real command `node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-live-http.mjs --run-compiled-browser` **PASSED, EXIT 0 in 96.71s**. No paid provider or customer data.

All 18 original Windows Better Auth security/HTTP/cleanup stages passed. Additionally **BOSTAN_WINDOWS_CHROMIUM_ASSET_PREFLIGHT_PASS**, **BOSTAN_WINDOWS_CHROMIUM_SIGNUP_PASS** and **BOSTAN_WINDOWS_CHROMIUM_FIRST_ADMIN_PASS** were confirmed through actual Playwright Chromium interaction with the built Bostan production UI, actual session cookie, original SHA256-packed local server and freshly migrated local PostgreSQL. Synthetic `example.invalid` identities only.

Final JSON receipt `authenticatedBrowserQualified:true`, `windowsAuthenticatedHttpQualified:true`, `outcome:"pass"`, `realHttpStatus:200`, `realSession:true`, `firstAdmin:true`, `childClosed:true`, `postgresCleaned:true`, `noOrphanPostgresProcessVerified:true`, `ownedFixtureCleaned:true`, `releaseQualified:false`.

Independent native Windows post-run read-only scan: **0 active postgres.exe, 0 B144-owned Node processes, 0 disposable B149 PostgreSQL/HTTP fixture directories**; the B135 shared checkout and B144 QA checkout tracked sources remained clean. D drive ~7.55 GiB free. Real browser/signup/first-admin now GREEN for this exact source and device, unlike the earlier low-resource failed attempt. This does NOT prove Windows member/invite UI, full UI semantic typecheck, installers or full release qualification.
