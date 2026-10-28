# B0-95 — Actual private bootstrap authorization and session identity gates

Date: 2026-10-28. PRIVATE Bostan engineering wave, stacked on B0-94 Draft PR #246. Repo remains PRIVATE, GitHub Actions OFF. Never merge to main, publish, deploy, access customer data or paid AI services.

## Gap

B0-93's independently verified native macOS synthetic localhost startup had demonstrated a healthy private authenticated HTTP endpoint, a successful synthetic signup with session cookie, first-admin claim HTTP 200 and clean server/DB shutdown. B0-94 hardened the child log proof against misleading stage markers. However, those observations alone did **not** prove the *negative* authorization properties of the first-admin endpoint: that an anonymous browser cannot claim control; that the session cookie is bound to the actual new user's identity; and that an already claimed instance cannot be claimed again.

## Source-grounded expectations

Existing application implementation `server/src/routes/access.ts` checks a private authenticated instance and `req.actor.type === "board"`, `req.actor.source === "session"` and a real `userId` before calling `claimFirstInstanceAdmin`. Existing unit suite `server/src/__tests__/bootstrap-claim-routes.test.ts` explicitly expects anonymous claim **401**, and an already-claimed first-admin claim **409**. Existing `server/src/routes/auth.ts` `GET /api/auth/get-session` returns the board actor's user identity and session `userId`.

## Changes

- Extend the opted-in **real macOS localhost PostgreSQL+HTTP** probe to send an anonymous same-origin `POST /api/bootstrap/claim` **before** any user exists. Require HTTP **401**; no user or token is printed.
- After synthetic signup, use the returned session cookie to call `GET /api/auth/get-session`; require **200**, matching returned user id, exact synthetic email, and matching session `userId`.
- After the first successful authenticated claim, repeat the exact claim using the same cookie and same origin; require HTTP **409**, not a second promotion or success.
- Extend `MAC_HTTP_REQUIRED_STAGES` to **10 ordered, unique exact-line markers**, with the three additional required denials/identity stages inserted at their correct causal positions. B0-94's fail-closed child-exit, no-timeout, no-failure-marker, bounded log and verified-owned-fixture cleanup criteria remain mandatory.
- Expand private receipt with `anonymousClaimDenied`, `signedInSession`, `repeatClaimDenied` booleans; never log credentials, cookies, response bodies, tokens, or user identifiers.
- Add tests proving that removal of any new authorization marker prevents qualification and checking the exact response/identity assertions in the runnable harness.

## Verification

- Node **22.16.0** local isolated unit run, using **exact GitHub blob content** of both `scripts/bostan-private-mac-http-evidence.mjs` and `scripts/bostan-private-mac-http-evidence.test.mjs`, confirmed by Git blob SHA: **8/8 PASS, 0 fail, 0 skip**.
- This is a pure log/evidence validator unit test. It does **not** run Bostan's real authenticated Express routes or PostgreSQL in this environment. Source-based expected HTTP statuses are grounded in existing route implementation and unit tests, but the additional B0-95 runtime HTTP calls remain **unverified**.
- The modified `scripts/bostan-private-mac-live-http.test.mjs` provides source-level safety assertions, but its full native Mac run remains pending because authorized Remote Desktop Commander quota was exhausted. Do not claim Mac full E2E PASS or cleanup of residual `bostan-b093*` directories. Do not retry a quota-paused connector.

## Next execution gate

On a safe native Mac with authorized available computer access, in a fresh owned `/private/tmp/bostan-b095` private checkout on this PR's **exact head** with Node >=24.11, frozen lockfile scoped dependencies and internal workspace builds, run:

```sh
node --test scripts/bostan-private-mac-http-evidence.test.mjs scripts/bostan-private-mac-live-http.test.mjs
BOSTAN_MAC_HTTP_QA=SYNTHETIC_ONLY node scripts/bostan-private-mac-live-http.mjs --run
```

Require `macAuthenticatedHttpQualified:true`, `timeout:false`, `ownedFixtureCleaned:true`, all **10** stage booleans true, the child exit code **0**, and zero owned PostgreSQL leftovers. Do not restart heavy Windows QA while C: has less than the B0-91 required 2 GiB free.

Remaining gates include Windows real server import/startup with instrumentation, Chromium/Playwright UI, real no-cost local agent workflow, reproducible compiled build, native Windows/macOS packaging and independent security/licensing.

**Bostan PRIVATE, Draft, release NO-GO.**