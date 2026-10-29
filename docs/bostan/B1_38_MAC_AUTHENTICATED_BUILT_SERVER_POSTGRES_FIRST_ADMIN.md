# B1-38 — Actual Mac built-server Better Auth, PostgreSQL and first-admin HTTP acceptance

Date: 2026-10-29. PRIVATE, NONPUBLISHING, ZERO-COST Bostan only. **Stacked parent B1-37 Draft PR #290** head `0df91bfb67c3a72b259ca0db877f1548c36b0613`. No protected-main merge, GitHub Actions enable, deploy, release, npm pack, paid provider/model, customer account/data or external network auth.

## Before: real local-trusted HTTP and PostgreSQL qualification

The preexisting `scripts/bostan-local-http-postgres-smoke.sh --run-dist`, run on the authorized Mac in clean isolated `~/Bostan-B135-qa` at commit `3e8a926048df8be3fcbf098734bde8b6a28c3ba4` with Node v26.0, actually:
- checked the private/local cloud gate (zero signals and paid providers), created a random disposable `/private/tmp/bostan-live-http.XXXXXX` cluster, migrated a real `127.0.0.1` PostgreSQL database,
- started the previously built, TypeScript-compiled `server/dist/index.js` on an ephemeral loopback HTTP port with `--conditions=bostan-compiled`,
- reached **HTTP 200**, health `ok`, `local_trusted`, exposure `private`, bootstrap `ready`, redacted cloud info, no external models,
- verified Bostan banner, owned processes terminated, `CLEANUP_COMPLETED exit=0`, wrapper **EXIT 0 in 11.47s**. No residual owned PG process at read-only inspection.

This **was not authenticated mode**; do not conflate with the next, separate result.

## New opt-in built-server authenticated fixture

Extend the *existing* localhost-only `scripts/bostan-local-http-postgres-smoke.sh` with explicit one-argument `--run-dist-authz`. No release artifact, browser, source compilation, cloud connection or production credential involved. It reuses the same disposable database, migration, synthetic ownership marker, private loopback HTTP checks, strict root/temporary-dir admission and owned shutdown as `--run-dist`, while setting only this test's authentication settings:

- `PAPERCLIP_DEPLOYMENT_MODE=authenticated` and `PAPERCLIP_DEPLOYMENT_EXPOSURE=private`; public Better Auth base URL exactly `http://127.0.0.1:<owned QA port>`, signup enabled, random one-time `BETTER_AUTH_SECRET`, cloud provider variables explicitly unset.
- Server must report `bootstrap_pending` on HTTP `/api/health` while anonymous before admin claim.
- Invoke the **existing real** `scripts/bostan-private-staged-authz-e2e.mjs` with a verified temporary `BOSTAN_TEST_ONLY_SENTINEL` whose exact bytes are `BOSTAN_TEST_ONLY\n`. It requires an exact `/bostan_qualification` localhost PostgreSQL URL and localhost auth public origin; this prevents mutations to foreign databases/users.
- In this new mode **only**, set `BOSTAN_AUTHZ_API_FIRST_ADMIN=1` after unsetting any inherited operator value. In the authz test, call the **real** `POST /api/bootstrap/claim` three ways: anonymous **401**, authenticated first real Better Auth user **200** with `claimed:true` and matching user ID, and authenticated second user **409**. Verify anonymous health has transitioned to `bootstrapStatus:'ready'`. The old staged API-only test remains backward-compatible with its legacy disposable SQL-seeded role; no misleading claim it tested the API.
- Continue the unmodified existing two-account, cookie, company, issue, invitation, viewer/revocation, operator promotion and suspension isolation checks on the real PostgreSQL/HTTP server.
- This source change modifies only **test harnesses**, no production routes, credential parser or browser.

## Actual native Mac real execution receipts

Mac worktree `~/Bostan-B135-qa` checked out exactly `f500cae9d3e72f6bf558097d10fcf839373fa840` for first new API-only acceptance: **40 authenticated HTTP requests**, two users, real PostgreSQL/Better Auth session cookies and cross-company isolation, exit **0**, runtime ~10.39s, `CLEANUP_COMPLETED exit=0`. **Caveat:** this first run SQL-seeded the first-admin role as before.

Next after adding actual first-admin claim at `d832753297176f68ecda311232ca868374288c8b`: **43 HTTP requests**, exact 401/200/409 admin claim and `bootstrapStatus:'ready'`, all previous tenant/invite/permissions checks passed, `providerCalls:0`, actual wrapper **EXIT 0 in ~10.31s**, no residual PG.

**Final verified head** `8b5a5c7bae7e62052ff13fada73b8c6758727a0d`: source Bash `bash -n` PASS, authz JavaScript `node --check` PASS; deliberately ran the new command with inherited `BOSTAN_AUTHZ_API_FIRST_ADMIN=0` to prove that the test mode explicitly sets its own authorization flag while preserving old modes. Final **43/43 actual synthetic localhost requests** with real ephemeral PG, Better Auth sessions, exact first-admin HTTP claim, cross-company 403/404 isolation, actual invitations and member suspension, **0 provider calls**, `BOSTAN_BUILT_SERVER_AUTHENTICATED_TWO_SESSION_QUALIFIED`, `CLEANUP_COMPLETED exit=0`, **FINAL_MAC_PG_AUTHZ_CLAIM_EXIT=0**, **PG_RESIDUAL=0**, runtime **13.12s**. Mac free disk ~16 GiB.

**Important qualification scope:** the tested server executable `server/dist/index.js` was produced by a previously passing Mac build from B1-35. The later commits only change the QA scripts; these final runs do **not** prove a fresh Mac source rebuild nor the independent packed esbuild `server/dist-runtime/index.mjs` for authenticated mode. The B1-36 compiled esbuild runtime itself separately booted HTTP health successfully. New mode `--run-dist-authz` proves authenticated **TypeScript-compiled JS**, not the standalone packed runtime.

## What is still NOT proven / NO-GO

No real Chromium/Playwright first-admin UI/signup, browser design/navigation, native Windows bundled server authentication/18-stage HTTP+PG issue #237, Windows multi-suite PostgreSQL orphan issue #234, full free genuine local agent execution, installers, Linux end-user journey, or cross-platform security/privacy/license/release qualification. Mac QA has no `ui/dist` and no installed Playwright browser at this check; browser must be independently built/tested. Windows full server TypeScript compile remains RAM-blocked under current user desktop load; do not trigger unsafe repeats. Preserve PRIVATE repo, stacked Draft PRs, no main merge, publication, deployment, release, npm pack, paid compute/model/provider, customer data or unowned process/file deletion. **Product release NO-GO.**
