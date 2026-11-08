# B0-59 — Real private Bostan browser signup into first-admin onboarding

**2026-10-27.** Stacked Draft above B0-58 PR #207 (`d785bb22843d4c88c8e3e34672336a62ebc0dc0c`). Keep Bostan private, Actions off, no main merge, publication, deployments, paid services, real-user details, or email sends.

## Why

B0-58 proved the real private first-admin **Claim this instance** button but created its first authenticated user by direct API in the synthetic fixture. The first-visit Bostan **Sign in → Create one → Create Account** route had not been exercised in the deployed Chromium UI.

## Opt-in browser path

The existing `--run-relocated-authz-ui` starts the production Bostan app in an ephemeral, privately relocated build with owned localhost PostgreSQL and no credentials for cloud providers. In this UI-only path:

1. Actual Chromium visits `/auth`, switches from sign-in to account creation, fills fixed synthetic test name and an `example.invalid` email, enters a fresh randomized test password, and **clicks Create Account**.
2. It observes the actual Better Auth `POST /api/auth/sign-up/email` (HTTP 200), validates the returned user ID, and obtains precisely one real session cookie from browser cookie storage without logging it.
3. A **new** Chromium browser context uses that same cookie for the real first-admin claim UI from B0-58; anonymous and second-user claim denials, actual health `ready`, two isolated companies, a third invited member, promotion/suspension and cross-company 403/404 checks remain in sequence.
4. The source-only and prior API-only authz paths continue to use their original signup and SQL-owned fixture; the new browser flow remains **opt-in**.

## Admission and safety

The new browser helper refuses non-localhost URLs, malformed test password, names other than `Bostan QA a`, any email outside the exact synthetic `bostan-qa-a-<uuid>@example.invalid` pattern, missing session cookie, more than one session cookie, external browser requests, and JavaScript exceptions. All contexts are closed in a `finally` block. No screenshot, cookie, password, token, or real identity is persisted to the receipt or repository.

## Measured evidence

- `node --test` for six relevant source/admission files: **13/13 PASS**, zero skipped/failures.
- **PASS**: `bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated-authz-ui` completed **EXIT 0** (84.62 seconds) on authorized Mac arm64 with the actual compiled and relocated Bostan server and UI, migrations, real private PostgreSQL, Better Auth and Chromium. Receipt `bostan.three-session-chromium-signup-first-admin.v3`: `passed=true`, `releaseQualified=false`, `sessionUsers=3`, `requests=47` counted explicit API calls, `providerCalls=0` (actual browser requests run in addition to those 47 calls).
- New `firstSignupBrowser.signedUpThroughActualChromiumUi=1` and `realSessionCookieReturned=1`; browser requests externally **0**. `firstAdminBrowser.claimedThroughActualChromiumUi=1`, anonymous/second claimant denials **1 each**, later member invite UI acceptance and membership suspension **PASS**; JavaScript errors and external browser requests on the first-admin and Members pages **0**.
- Native markers `BOSTAN_PRIVATE_RELOCATED_MEMBER_BROWSER_ACCEPTANCE_PASS`, `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, `CLEANUP_COMPLETED exit=0` all present. No stage, model calls or disposable PostgreSQL QA data remained.
- Original standalone API-only mode `--run-relocated-authz` already passed on B0-58, and this PR has not modified its control-flow branch or source fixture; that separate run is not falsely presented as a B0-59 exact-head retake.

Release remains **NO-GO**; Windows/Linux installers, actual agent compute reliability, email delivery, broader role/security/legal tests remain open.
