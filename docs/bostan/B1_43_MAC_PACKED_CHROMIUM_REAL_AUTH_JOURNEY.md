# B1-43 — Real native Mac Chromium authentication against SHA-owned Bostan packed server

Date: 2026-10-29. PRIVATE, ZERO-COST, NONPUBLISHING. Stacked parent B1-42 Draft PR #295 exact HEAD `9ddd8924271f0de08d518c5f12ab354a4b72862a`. Protected `main` unchanged.

## New opt-in proof

The earlier B1-41 Chromium test served production UI with local Vite, but without the authenticated server. B1-40's SHA-owned packed server passed Better Auth + PostgreSQL HTTP, without actual browser interactions. This QA-only change adds `--run-packed-authz-ui` to the already isolated localhost PostgreSQL shell harness, **reusing** the existing real Chromium signup, first-admin and member-management E2E helpers. It changes no production auth/authorization algorithms.

- Admits the exact server `dist-runtime` via its existing SHA256 ownership verifier, then requires native macOS, a uniquely named owned `Bostan-B###-qa` source checkout, a regular production UI `ui/dist/index.html`, a pinned Playwright import, and a real browser directory in an owned Mac QA checkout. Missing/foreign browser paths are refused **before** any test database is created.
- Reuses the local random ephemeral-loopback PostgreSQL database, authenticated Better Auth settings, local-only packed server `server/dist-runtime/index.mjs`, bounded health probes, actual real UI pages served by the same API origin, and exact-owned server/cluster cleanup. The older `--run-packed-authz` is not replaced.
- Enforces Playwright interception of external requests and fails on browser JavaScript errors. Test-only sign-up identities use `example.invalid`; generated session cookies, secrets and database URLs are never written to test receipts. No AI providers, paid compute, Cloud, customer data, Actions, deployment or publishing.

## Executed native Mac receipts

Dedicated isolated `~/Bostan-B142-qa` worktree from the exact B1-41 PR head, separate from the existing active `Bostan-B135-qa`. Its compiled server dist and production UI dist were copied from the B1-41 QA checkout (same unchanged production source); the packed runtime was **freshly regenerated for this new QA path**, rather than trusting a moved ownership marker: esbuild **2366 inputs, 119 chunks, EXIT 0 in 6.42s**. Reused already installed frozen workspace dependencies and the free, isolated Playwright Chromium from the owned `Bostan-B135-qa/.qa-playwright-browsers` directory; no download or paid model.

```sh
bash -n scripts/bostan-local-http-postgres-smoke.sh
node --test scripts/bostan-local-http-postgres-smoke.test.mjs \
  ui/scripts/bostan-private-auth-signup-browser.test.mjs \
  ui/scripts/bostan-private-first-admin-browser.test.mjs \
  ui/scripts/bostan-private-members-browser.test.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/Bostan-B135-qa/.qa-playwright-browsers" \
  bash scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz-ui
bash scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz
```

Actual results:
- Bash syntax **PASS**; focused Node regression **10/10 PASS**, including negative `--run-packed-authz-ui` with missing browser path: exit 2, no `MIGRATED`, no server bootstrap.
- Production packed runtime SHA256 ownership **PASS**; real isolated migrated PostgreSQL **PASS**; actual authenticated Bostan health returns HTTP 200 and bootstrap-pending before user claim.
- **Real Chromium+packed server integration PASS in 13.57s**: 47 actual authenticated HTTP requests, **3** user sessions, first-user account creation through production sign-up page with real Better Auth cookie, actual first-admin UI claim, anonymous and second-user claim refusals, company isolation, viewer write denial, real browser invitation, third-session acceptance, browser role promotion and suspension with access denials; `providerCalls:0`, `browserJsErrors:0`, `externalBrowserRequests:0`.
- Receipts: `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PACKED_SERVER_CHROMIUM_AUTHZ_UI_QUALIFIED`, `CLEANUP_COMPLETED exit=0`.
- Historical **non-Chromium packed mode still PASS** in 12.79s: 43 actual requests, two real Better Auth sessions, own PostgreSQL instance, zero provider calls; `BOSTAN_PACKED_SERVER_AUTHENTICATED_TWO_SESSION_QUALIFIED`, `CLEANUP_COMPLETED exit=0`.
- Read-only post-run scan: no `bostan-live-http.*` scratch directories or PostgreSQL process with that owned scratch identifier. The unrelated longstanding Homebrew PostgreSQL service was not touched.

## Explicit limits — release NO-GO

This tests an authenticated Mac browser session on built UI and rebuilt packed runtime using previously compiled server JS; it is **not** a fresh full TypeScript semantic typecheck or a newly built native Windows/Linux installer. The Windows packed startup/PG suite remains RED (#237/#234). Still need genuine zero-cost offline agent task execution, Windows + Linux product qualification and installers, independent security/privacy/licensing/NOTICE/provenance checks, and all release gates. Never merge protected `main`, publish, release, enable Actions, use paid providers, or process real user data.
