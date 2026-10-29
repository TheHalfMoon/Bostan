# B1-50 — Native Windows real Chromium Members/Invites QA (resource-blocked, not qualified)

Date: 2026-10-29. STRICT PRIVATE, ZERO-COST, NONPUBLISHING. Exact parent #303 Draft at bfa66d73c54eacb38908989e17f55c12370f24db.

## Engineering implemented, no product code change

New explicit opt-in `scripts/bostan-private-windows-live-http.mjs --run-compiled-browser-members` extends B1-49's real built Vite UI, pinned headless Chromium, SHA256-owned packed server, real disposable PostgreSQL, verified Better Auth first-user signup, real browser first-admin claim and all 18 original HTTP/security/teardown checks. The new member mode is not implicit in other modes and still uses strict QA-only host, exact owned root/TEMP, synthetic example.invalid identities, no cloud/provider secrets, >=4 GiB preflight memory and >=3 GiB after PG migration.

Within that same disposable database, a real first-admin session creates a company; another real synthetic Better Auth session is created, and the browser helper from the already-qualified Mac B1-43 Members UI is reused to create a viewer invitation via actual Chromium UI. That invitation is accepted as the third session using real API; viewer write is denied; actual Members UI promotes the user to operator, write becomes allowed; the same real UI suspends the user, and write is again denied. Cookie/password/invitation token remain process-local and must not appear in receipts. Each response is strictly checked, and the output `authenticatedMembersBrowserQualified` may be true only if all member-UI and base backend/cleanup checks pass.

## Tests actually executed

- Mac Node focused unit/security/browser-helper tests: **14/14 PASS** at source commit `757f08295873e2fe25b377d07c41268e563e7f25`.
- Windows native Node test-only startup/QA environment tests: **8/8 PASS** on same commit.
- Windows native real `--run-compiled-browser-members`: **NOT RUN / NOT QUALIFIED** because preflight observed **3.72 GiB** of free RAM, below the 4 GiB fail-closed minimum. Did not start PostgreSQL or Chromium in that refused attempt. Follow-up read-only resource check found 3.45 GiB free and 0 PostgreSQL processes. No user applications or foreign services were stopped to force the gate green.

## Required next proof

Only rerun native Windows `--run-compiled-browser-members` if real disk/RAM/owned-process preflight allows it. Inspect and fix actual browser or API failures if any, require authenticated Chromium UI invitation+promotion+suspension as well as full 18-stage PG/HTTP owned teardown, zero external network requests and zero browser JS errors. Existing B1-49 Windows Chromium first-signup/first-admin is GREEN (96.71s), but cannot be substituted for this stronger Members gate.

This project is still release NO-GO: native installers/Linux, actual free offline local agent, multi-suite PG concurrency/stress, full repository typechecks and independent security/privacy/license/provenance work remain. No release, protected-main merge, publish, deploy, npm pack or GitHub Actions enablement.
