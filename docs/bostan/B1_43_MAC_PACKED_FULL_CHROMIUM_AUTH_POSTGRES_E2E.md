# B1-43 — Real Mac Chromium signup / first-admin / members on SHA-owned packed Bostan server

Date: 2026-10-29. PRIVATE, ZERO-COST, STRICTLY NONPUBLISHING. Exact parent B1-42 Draft PR #295 head `9ddd8924271f0de08d518c5f12ab354a4b72862a`.

## Previously separate evidence now combined in ONE actual test

Earlier B1-40 qualified 43 authenticated HTTP API calls against the *real* SHA-owned `server/dist-runtime/index.mjs` with disposable PostgreSQL on Mac, but no Chromium. B1-41 proved actual production `ui/dist` in real Chromium served from a localhost Vite preview with zero external requests/errors, but no backend or user journeys. This B1-43 mode **combines all four components**: production built Vite assets served **by the packed Bostan application**, real Chromium, real Better Auth, actual migrated ephemeral localhost PostgreSQL.

Add an **explicit opt-in** `--run-packed-authz-ui` to the existing private `scripts/bostan-local-http-postgres-smoke.sh`. No production app routes, schemas, bundled runtime, model adapter algorithms or UI source were modified.

Before creating any fixture, the new mode requires safe regular production `ui/dist/index.html`, non-linked `ui/dist`, isolated existing QA Chromium directory `$REPO/.qa-playwright-browsers`, the existing cloud/private gate, and exact SHA256 ownership of `server/dist-runtime` via the unchanged `assertSafeRuntimeOutdir`. Then:

- Launch a real disposable PostgreSQL instance on loopback, create `bostan_qualification` test DB, run real migrations. Use random ephemeral localhost HTTP, synthetic Better Auth secret and users, `PAPERCLIP_DEPLOYMENT_MODE=authenticated`, exposure private, `SERVE_UI=true`.
- Launch **`node server/dist-runtime/index.mjs`** with no TSX or fallback to source. Its static UI handler serves the existing compiled Vite assets from the monorepo. Health must first return HTTP 200 and `bootstrap_pending`.
- Set `PLAYWRIGHT_BROWSERS_PATH` only to the checkout-owned cached Chromium. `BOSTAN_AUTHZ_BROWSER_UI=1` is explicitly set only for this mode; any inherited operator override is cleared before QA selection. The existing `bostan-private-staged-authz-e2e.mjs` loads the dedicated **actual browser** sign-up, first-admin claim and signed-in Members UI helpers.
- Chromium signs up the **first** user through the real `/auth` UI, persists an authenticated Better Auth cookie, and claims instance admin from the real on-screen `Claim this instance` button. A second user and third independent browser session exercise company issue isolation, invites, member role promotion and suspension. All helper routes block non-local browser network requests and count JavaScript exceptions; never print cookies/passwords.
- Only after all product checks pass emit `BOSTAN_PACKED_SERVER_AUTHENTICATED_CHROMIUM_JOURNEY_QUALIFIED`. Existing deterministic cleanup shuts down the exact child server and disposable PG, and removes only its uniquely owned QA temporary directory.

## Actual Mac device and execution

Authorized macOS arm64 `~/Bostan-B135-qa`, Node26, pinned browser via Playwright 1.62.1, compiled UI `ui/dist`, *previously built* SHA256-owned real 119-chunk packed runtime. Exact code HEAD `442fc48f684747d00c73543648c73906dee635bc`.

- Bash `bash -n` PASS; explicit `--help` lists new UI mode; `ui/dist/index.html` exists; owned Chromium headless shell present. Before run ~15GiB disk available and 53% free memory.
- Executed `DO_NOT_TRACK=1 OTEL_SDK_DISABLED=true BOSTAN_FEEDBACK_EXPORT_ENABLED=0 bash scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz-ui` after unsetting model/API/telemetry provider secrets. **Actual EXIT 0 in 13.01 seconds**, real `MIGRATED`, `BOSTAN_PACKED_SHA256_RUNTIME_OWNERSHIP_VERIFIED`, real localhost authenticated `/api/health HTTP 200`, bootstrap pending, real Bostan server banner.
- Full result `schema=bostan.three-session-chromium-signup-first-admin.v3`, **`passed:true`**, **47 real HTTP requests**, **3 real session users**, 2 independent company memberships, zero external model/provider calls. First-user browser proof: `signedUpThroughActualChromiumUi:1`, `realSessionCookieReturned:1`, `externalBrowserRequests:0`. First-admin browser proof: `claimedThroughActualChromiumUi:1`, `claimedUserIdMatchesSession:1`, `browserJsErrors:0`, `externalBrowserRequests:0`.
- Browser Members UI proof: `realChromiumInviteCreated:1`, `inviteAcceptedByThirdSession:1`, `viewerTaskWriteDenied:1`, `uiPromotionEnablesWrite:1`, `uiSuspensionDenials:2`, `memberUiUpdates:2`, **`browserJsErrors:0`**, **`externalBrowserRequests:0`**. Other API receipts: cross-company list/detail/write denials, foreign task 404 same as nonexistent, one viewer allowed read but denied writes, unauthorised invite/promotion refusals and suspension denials.
- Exact `BOSTAN_PACKED_SERVER_AUTHENTICATED_CHROMIUM_JOURNEY_QUALIFIED` and `CLEANUP_COMPLETED exit=0`; test wrapper `MAC_PACKED_REAL_BROWSER_AUTHZ_EXIT=0`. Mac free disk ~15GiB and >40% free memory after run.
- Independent post-run scan: **0 Bostan-owned PostgreSQL subprocesses**, **0 packed Bostan server processes**, **0 owned Chromium processes** and zero tracked Git changes. Note the Mac has a preexisting, **unrelated Homebrew PostgreSQL 17 service**; it was never touched, stopped, or used by this private test.
- Backwards-compatibility regression: exact same new shell source `--run-packed-authz` **EXIT 0 in 10.29s**, 43 real HTTP API requests and `CLEANUP_COMPLETED exit=0` with no browser; a transient post-run process match was rechecked and **0 owned scratch PostgreSQL processes remained** (the unrelated Homebrew server stayed running).

This is **genuine one-run Mac UI+backend+PostgreSQL+Better Auth E2E**, not simulated Playwright results. No release claims beyond this OS and test scope.

## Remaining product NO-GO

Native Windows still has a real 238-file SHA-owned compiled runtime, but its **real** PG+HTTP start timed out after 180s and DB cleanup failed in that attempt (#237/#234). B1-42 bounded no-real-PG probe isolated the first pre-import stage but not a causal source module. Windows full authentication+browser/first-admin/PG cleanup, multi-suite orphan checks, Linux end-user path, first real no-cost offline agent, installer packaging, accessibility, performance under production workloads, privacy/security/license/NOTICE and full semantic typecheck/release qualification remain **open**. No GitHub Actions activation, protected-main merge, publish, deploy, release/npm pack, paid compute/model or user/customer data. **Release remains NO-GO**.
