# B0-58 — Live first-admin claim through private Bostan Chromium UI

**2026-10-27.** Stacked after B0-57 Draft PR #206 on `work/b0-57-actual-browser-human-invite-ui`. Keep Bostan private, GitHub Actions off, `main` unchanged, and the new PR Draft. No deployment, release, paid model, real-user data, or sending invitations.

## Qualification gap

B0-57 validated the actual member-management React UI but seeded the test's initial `instance_admin` record directly into an owned ephemeral PostgreSQL database. Thus it did **not** prove the initial **Finish setting up Bostan → Claim this instance** workflow.

## Change

On the existing opt-in `--run-relocated-authz-ui` route only:

- The disposable fixture signs up two independent Better Auth sessions and checks an unauthenticated `POST /api/bootstrap/claim` is denied before any claim.
- Actual signed-in Chromium visits `/` on the compiled, privately relocated server, sees **Finish setting up Bostan**, clicks **Claim this instance**, and verifies the actual `POST /api/bootstrap/claim` succeeds with the same user ID.
- Chromium enforces localhost-only requests, blocks service workers, refuses missing/invalid cookies and remote origin, checks JavaScript errors, and closes the browser even on failure. Cookie and identities are never printed.
- A second authenticated user cannot claim the already-owned instance (HTTP 409), and an actual health request confirms `bootstrapStatus=ready`.
- The earlier source/API-only `--run-relocated-authz` keeps its original temporary SQL fixture and receipt; the member invitation/role/suspension browser tests still run after first-admin claim in the UI mode.

## Test commands

```sh
node --test ui/scripts/bostan-private-first-admin-browser.test.mjs ui/scripts/bostan-private-members-browser.test.mjs scripts/bostan-local-http-postgres-smoke.test.mjs
bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated-authz-ui
```

## Real executed evidence — macOS arm64, 2026-10-27

**PASS:** the full production-build, private-stage relocation, PostgreSQL migration, real Better Auth and Chromium flow exited **0** (100.51 seconds) after a clean source-level correction in the new test helper. Receipt `bostan.three-session-chromium-members-first-admin.v2` shows:

- `passed=true`, `releaseQualified=false`, `sessionUsers=3`, `requests=48`, `providerCalls=0`.
- `firstAdminBrowser.claimedThroughActualChromiumUi=1`, `claimedUserIdMatchesSession=1`, `browserJsErrors=0`, `externalBrowserRequests=0`.
- `secondAdminClaimRejected=1`, `anonymousAdminClaimRejected=1`.
- `browserUi.realChromiumInviteCreated=1`, `inviteAcceptedByThirdSession=1`, `uiPromotionEnablesWrite=1`, `uiSuspensionDenials=2`, `memberUiUpdates=2`, with zero browser JS errors and external network requests.
- Actual test printed `BOSTAN_PRIVATE_RELOCATED_MEMBER_BROWSER_ACCEPTANCE_PASS`, `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, and `CLEANUP_COMPLETED exit=0`.
- Five source/admission test files, including the new first-admin helper tests, returned **11/11 PASS**; no skipped or failed tests.
- The initial first-admin helper validator contained an over-escaped regex. The local test failed, was fixed, and the **final** Node suite and full live qualification both passed. The failed exploratory run is not treated as evidence of success.

The private build used npm's public free registry for a missing frozen-lockfile tarball, without paid model calls or external customer accounts; actual app browser requests were confined to `127.0.0.1`. CLI/package installation is not a qualified consumer release.

**Historical API-only mode regression — PASS:** A separate clean `--run-relocated-authz` retake exited **0** (86.92 seconds). Original receipt `bostan.two-authenticated-sessions.v2` was retained unchanged: **two sessions, 40 HTTP requests, no provider calls**, and the previous local private staging, isolation and cleanup markers all passed. This confirms the new UI-only first-admin flow did not alter the earlier opt-in API scenario.


## Boundaries and release decision

This verifies private, local first-admin ownership with synthetic users. Public signups, email sending, actual deployment, desktop installers for Windows/Linux, user onboarding every branch, independent adversarial security/licensing review and free-model agent execution remain separate **NO-GO** qualifications. Do not report them as proven by this scenario.
