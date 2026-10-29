# B1-53 — Real native Windows Chromium Members: invitation, promotion and suspension GREEN

Date: 2026-10-29. STRICT PRIVATE, ZERO COST, NONPUBLISHING. Exact parent B1-52 Draft #306 HEAD `003263a66cba608f4d2fa4c4a024d094bea16325`.

## Root cause investigated and test-only correction

B1-52 observed native Windows Chromium `members_browser_js_unclassified` before the real Members invite button. B1-53 added privacy-preserving, **bounded allowlist-only** error fingerprinting: error kind, predefined harmless diagnostic lexicon terms and length bands, no raw browser stack/message, URL, email, token, paths or session cookie. The actual native Windows failure signature was `kind:other`, `words:failed_read_property_access_localstorage`, `size:medium`. This is consistent with an opaque-origin frame throwing while reading its localStorage.

Review found the *test-only* Members helper's `context.addInitScript` ran `localStorage.setItem` **in every page and subframe**, including possible opaque-origin or sandboxed frames. The helper now runs this app-company selection initializer **only** when `window.top === window` and `window.location.origin` exactly equals the previously validated localhost app origin. It does **not** catch/suppress errors on the actual top-level Bostan document. Existing context-level HTTP, popup, WebSocket and JavaScript exception guard remains enabled and fails closed.

Added direct VM regression for exact same-origin top-level storage, foreign top-level, foreign/opaque sandboxed frame, and a throwing localStorage getter. Positive top-level still throws if storage itself becomes inaccessible. Added synthetic popup page exception test proving credentials/URLs never appear in emitted error text. No production UI/server/database models or migrations were changed.

The failure fingerprint and successful exact same-device A/B reexecution are strong evidence this QA-injected storage access was responsible; no raw stack or sensitive telemetry was needed. The unchanged actual production Members UI now completes under the strict browser checks.

## Actual Mac acceptance on final test-only code

Authorized native macOS `~/Bostan-B142-qa`, exact code HEAD `25ac9f35bafc675d12f8e53ce36d887ce8eb1c75`. Existing SHA256-owned 119-chunk real packed server, real prepared Vite `ui/dist`, real fresh isolated PostgreSQL, Better Auth, real pinned Chromium; isolated clone-on-write browser cache created only in B142 (source B135 untouched).

Command `DO_NOT_TRACK=1 OTEL_SDK_DISABLED=true BOSTAN_FEEDBACK_EXPORT_ENABLED=0 bash scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz-ui`:
- **REAL EXIT 0 in 21.50 seconds**.
- **47 real HTTP requests**, 3 real session users (synthetic addresses), two independent company memberships.
- `BOSTAN_PACKED_SERVER_AUTHENTICATED_CHROMIUM_JOURNEY_QUALIFIED`.
- Actual DOM signup, first-admin claim, Members invite creation and acceptance, viewer denied write, operator promotion enabled write, suspension revoked writes; **zero browser JS errors, zero external requests, no model/provider calls**.
- `CLEANUP_COMPLETED exit=0`. Own cloned test browser cache later explicitly deleted after verifying zero B142-owned server/browser processes and source B135 cache remained intact; Mac tracked source clean. No unrelated Homebrew PostgreSQL touched.

Mac real pinned Chromium negative external HTTP/popup/WebSocket test suite **23/23 PASS with no skipped tests**, confirming the network guard was not disabled to obtain green.

## Actual Windows acceptance on final code — GREEN (previously RED)

Authorized actual native Windows 11 `Abdulaziz`, exact B144 QA checkout HEAD `25ac9f35bafc675d12f8e53ce36d887ce8eb1c75`, matching exact owned B144 TEMP, free RAM admitted at **5.55 GiB**, no pre-existing PostgreSQL. Pinned local Chromium and actual previously SHA256-built packed server, production built Vite UI, real fresh PostgreSQL and Better Auth.

Actual command:
```powershell
$env:TEMP='D:\Bostan-B144-temp'
$env:TMP=$env:TEMP
$env:PLAYWRIGHT_BROWSERS_PATH='D:\Bostan-B144-qa\.qa-playwright-browsers'
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-live-http.mjs --run-compiled-browser-members
```

- **REAL EXIT 0 in 46.61 seconds**, `BOSTAN_WIN_MEMBERS_STAGE=members_complete`, `BOSTAN_WINDOWS_CHROMIUM_MEMBERS_INVITE_ROLE_SUSPEND_PASS`.
- Actual production UI browser signup, first-admin claim, company creation, independent third Better Auth user/session signup and sign-in, real DOM invite creation; independent third user accepted the invite via authenticated API.
- Viewer task write **403**, DOM promotion to operator, operator issue write **201**, DOM suspension of the exact same member, suspended write **403**.
- All **18 existing** Windows HTTP/PG security/teardown receipt stages passed, including anonymous/cross-origin/cross-scheme/referer/missing-origin/repeated bootstrap denial.
- Final JSON `authenticatedBrowserQualified:true`, `authenticatedMembersBrowserQualified:true`, `windowsAuthenticatedHttpQualified:true`, `outcome:"pass"`, `releaseQualified:false`, `realHttpStatus:200`, `realSession:true`, `firstAdmin:true`, `childClosed:true`, `postgresCleaned:true`, `ownedFixtureCleaned:true`, `noOrphanPostgresProcessVerified:true`.
- Prior native Windows fixed QA tests **12/12 PASS**. Independent *post-run* read-only Windows check found **0** postgres processes, **0** B144-owned Node processes, **0** owned auth fixture directories, and **0 tracked changes** in B144/B135; D free **7.80 GiB**.

The old B1-52 Windows Members E2E RED and its exception are **resolved for this exact SHA, hardware, resource envelope and test journey**. Do not equate that with universal app correctness, full Linux native qualification or release-readiness. The production app was not patched; only the unsafe browser **test injector** was corrected.

## Remaining NO-GO release gates

A real free offline agent execution task, full Linux user journey, native Windows/Linux installer/package verification, concurrent multi-suite PostgreSQL stress beyond sequential stop gates, independently complete security/privacy/NOTICE/third-party license/provenance audits, accessible/performance/user-facing acceptance, and integration/CI validation under the stacked protected branch are still outstanding. Strictly PRIVATE DRAFT, no protected-main merge, GitHub Actions enablement, deploy, npm publish/pack, release, paid inference or customer data. Never touch unrelated app/process or files.

## Post-fix UI component regressions on both native operating systems

On the same unchanged B1-53 product source, run actual workspace Vitest directly on the **source** `ui/src/pages/CompanyAccess.test.tsx` and `ui/src/components/access/InvitesSection.test.tsx`:

- Native Mac `CI=1 DO_NOT_TRACK=1 pnpm --filter @bostan/ui exec vitest run src/pages/CompanyAccess.test.tsx src/components/access/InvitesSection.test.tsx --reporter=dot`: **20/20 PASS**, two files, exit 0, 2.40s runner.
- Native Windows at SHA `25ac9f35bafc675d12f8e53ce36d887ce8eb1c75`: same 20/20 PASS, two files, exit 0, 15.70s runner, no real PG or model calls. Windows memory admission measured 4.08 GiB available and bounded Node heap to 1.5 GiB for this test.
- These tests supplement, rather than substitute for, real Chromium/PG E2E. They do not qualify every UI component, end-user accessibility, Linux or release packaging.

## Additional native Linux / WSL2 source-guard tests — PASS, not an app E2E

Using **actual native Ubuntu WSL2 Linux kernel 6.18.33.1 x86_64, Node 22.22.1** on authorized Windows without modifying the user's Linux installation, run Node `--test` against the same B144 QA source mounted read-only for this exercise:
- `scripts/bostan-private-linux-native-build-closure.test.mjs`, `bostan-private-linux-native-prebuilt-stage-authz.test.mjs`, `bostan-private-linux-tmpfs-admission.test.mjs`: **15/15 PASS**, no skips, exit 0 (~1.07s).
- `scripts/bostan-private-windows-auth-browser-gate.test.mjs` and `bostan-private-windows-qa-env.test.mjs`: **10/10 PASS** with Linux-native Node, no skips.
- This was a **test-only** native Linux execution (no PostgreSQL installation, backend startup, browser, Linux package build or installer). Read-only tool inspection found Ubuntu WSL2 and Node installed but did not find a Linux `pg_ctl` binary on the search path. The detected `pnpm` was the Windows-mounted binary rather than proven isolated Linux toolchain.
- Linux **product** runtime E2E, native dependency closure and installation remain NO-GO, do not conflate these Linux unit-test passes with end-user release readiness. No package installation, GitHub Actions activation, paid provider, source mutation or shared service stop occurred.
