# B0-98 — Same-scheme board mutation origin qualification

Date: 2026-10-28. PRIVATE Bostan, stacked after B0-97 Draft PR #249; no protected-main merges, releases, deployments, GitHub Actions changes, user data or paid models.

## Reproduced source defect

B0-97 already refused malformed Origin strings and contradictory untrusted Origin/trusted Referer. Its `trustedOriginsForRequest(req)` still automatically trusted **both** `http://${Host}` and `https://${Host}` regardless of the scheme carrying the current request. This is not an origin equivalence: the scheme is part of the browser's origin tuple.

An isolated actual TypeScript module execution reproduced the discrepancy with the previous exact GitHub source: an HTTPS request (`req.protocol="https"`) to `private.example.invalid:42000` with `Origin: http://private.example.invalid:42000` was accepted as a trusted origin; the reverse HTTP/HTTPS mismatch was also accepted. No claim of a browser-exploitable authentication bypass is made: real exploitability depends on cookie settings, network exposure and other security controls.

## Repair

- For dynamically trusted `Host` (or trusted `X-Forwarded-Host`), add only `${req.protocol}://${host}` to the allowed origins, when the Express-calculated request protocol is exactly `http` or `https`. Unknown protocol grants no automatic Host-derived trusted origin.
- The request scheme is determined by the real socket or `X-Forwarded-Proto` only when Express's immediate-peer trust-proxy configuration accepts that proxy. No raw untrusted forwarded-proto header is used in the guard.
- Preserve the explicitly allowed localhost development origins and operator-configured `PAPERCLIP_PUBLIC_URL`; these are *explicit exceptions* and are **not** implied automatically by the request Host. Preserve Origin precedence, canonical serialized Origin validation, board-key bypass and the existing Referer-only fallback contract.
- Add three server Vitest/Supertest regression cases: HTTPS Origin on direct HTTP Host -> **403**, HTTP Origin on trusted-proxy HTTPS Host -> **403**, HTTPS Origin on trusted-proxy HTTPS Host -> **204**.
- Extend opted-in real Mac localhost PostgreSQL+HTTP first-admin smoke with an HTTPS Origin against its actual HTTP server using the *same loopback Host and port*, requiring **403** before valid claim. Add `BOSTAN_MAC_HTTP_CROSS_SCHEME_CLAIM_DENIED` at its causal position in the strict proof; all **16** markers, no timeout, clean exit and owned fixture cleanup remain mandatory.

## Verified local evidence

Node **22.16.0**, isolated Linux container, exact source bytes reconstructed from GitHub:

| Evidence | Exact Git blob | Result |
|---|---|---|
| Prior B0-97 guard `board-mutation-guard.ts` | `338b8178669645aa5c0545d601a1aa1323ce208d` | Cross-scheme acceptance reproduced |
| Current B0-98 guard `board-mutation-guard.ts` | `74089bc2c67bdc8f09854411e3676c349d943747` | TS transpilation 0 diagnostics; **18/18 direct mocked Request/Response runtime cases PASS** |
| Current 16-marker evidence evaluator | `f19862216c65b7755c0c40618eaf03c6df23d9bb` | Exact source reconstructed |
| Current 16-marker evaluator unit suite | `eaed44ee86c5f91fffa043f60f124f5d84edbdda` | `node --test`: **9/9 PASS**, 0 fail, 0 skipped |

The 18 cases cover previous cross-scheme acceptance in both directions, both cross-scheme denials after patching, correct-scheme acceptance, trusted/untrusted proxy distinctions, missing protocol fail-closed, malformed Origin, trusted Referer fallback, safe GET, browser-key bypass, and explicit configured public URL exception. They execute transpiled actual source with synthetic mocks, **not** a real Express server.

## Still unqualified

- New server Vitest/Supertest regressions have not been run against the complete repository dependencies.
- B0-98's modified real native macOS PostgreSQL+HTTP smoke has not been executed on the exact PR head. Earlier B0-93 manual macOS localhost PostgreSQL/HTTP/signup/admin/shutdown succeeded, but it did not exercise the new cross-scheme request or the subsequent 16-stage proof.
- Desktop Commander monthly quota was exhausted on 2026-10-28: do not retry/reconnect while suspended. On return of authorized access, inspect only positively identified test-owned `/private/tmp/bostan-b093*` residual directories after confirming no owned live processes. Rebuild a fresh private `/private/tmp/bostan-b098` checkout at the exact PR head with Node>=24.11 and frozen pnpm, then run `node --test scripts/bostan-private-mac-http-evidence.test.mjs scripts/bostan-private-mac-live-http.test.mjs`, the full server board mutation regression tests, and `BOSTAN_MAC_HTTP_QA=SYNTHETIC_ONLY node scripts/bostan-private-mac-live-http.mjs --run`. Require 16 true markers, clean exit, timeout:false, ownedFixtureCleaned:true and zero orphaned test PostgreSQL processes.
- Windows C last had about 0.323 GiB free, below B0-91's 2 GiB admission. No heavy native Windows tests/installs/PG or Chromium until that guard passes; do not delete user files.
- Full native Mac/Windows Chromium Playwright, zero-cost real agent workflows, compiled build, native installers and independent licensing/security remain open.

**Bostan PRIVATE — Draft — release NO-GO.**
