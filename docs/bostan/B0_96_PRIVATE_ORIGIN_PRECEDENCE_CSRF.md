# B0-96 — Private first-admin origin precedence and CSRF qualification

Date: 2026-10-28. PRIVATE Bostan, stacked on B0-95 Draft PR #247. No GitHub Actions, merge, release, deployment, paid models or customer data.

## Concrete security defect identified

`trustedBoardMutationOrigin(req)` in `server/src/middleware/board-mutation-guard.ts` originally accepted a trusted `Referer` when an explicitly supplied `Origin` was present but **untrusted**. For example:

```
Origin: https://attacker.example.invalid
Referer: http://localhost:3100/private
```

The previous helper returned the trusted Referer origin instead of refusing. This is an origin-header precedence defect, not proof of a browser exploit or external exposure. Browser-set Referer is normally constrained, but conflicting headers must never promote an untrusted Origin to a trusted mutation.

## Production source repair

- When an `Origin` header is **present**, parse and verify it against the normal trusted origin set. Reject untrusted, opaque, empty or malformed values immediately. Do **not** consult `Referer`.
- If `Origin` is **absent**, retain existing compatibility behavior: a trusted `Referer` can authorize a board-session mutation; without both, refuse.
- Preserve the existing safe-method behavior, non-browser board key/tenant pathways, and the existing trust-proxy protection for `X-Forwarded-Host`.
- Add Vitest/Supertest regression cases: conflicting hostile Origin + trusted Referer -> **403**; opaque/malformed Origin + trusted Referer -> **403**; trusted Origin + unrelated Referer -> pass. Existing trusted-Referer-only test remains unchanged. New server Vitest tests have **NOT** been run in the native full workspace yet.

## B0-96 real macOS HTTP qualification extension

B0-95's synthetic-only real PostgreSQL/HTTP/first-admin probe now asserts *after signing in and verifying the exact synthetic user's session, but before the first valid first-admin claim*:

1. Session cookie + hostile Origin `https://attacker.example.invalid` -> HTTP **403**.
2. Session cookie + hostile Origin **and forged trusted Referer** -> HTTP **403**. This directly exercises the source guard defect.
3. Session cookie + **no Origin and no Referer** -> HTTP **403**.
4. All forbidden attempts preserve `bootstrap_pending` in `GET /api/health` -> HTTP **200**.

These checks must all succeed before the legitimate claim runs; the test still requires the correct admin user identity, repeat-claim conflict 409, post-claim readiness, and verified server/PG shutdown. The strict proof now requires **14 exact, unique, ordered markers**, no child signal/error/timeout, zero exit and successful owned fixture cleanup.

## Verified results on isolated local Node 22.16.0

- Exact GitHub blob `server/src/middleware/board-mutation-guard.ts` was reconstructed byte-for-byte and its `git hash-object` matched **`37388d3ab4d126725d97ba1153b6fdfb52294491`**. It was transpiled with installed TypeScript, **0 transpile diagnostics**, and directly executed with mock Express request/response objects: **8/8 runtime cases PASS**, covering conflicting headers, opaque/malformed Origin, trusted-Referer fallback, valid Origin precedence, absent headers, forged `X-Forwarded-Host`, trusted-proxy checks, and safe GET.
- An isolated before/after replay of the conflicting-header request demonstrated **old helper returned `http://localhost:3100`**, while **patched helper returned `null`**; the exploit-precondition regression is proven.
- Exact GitHub blobs of strict evidence module and its tests matched Git hashes **`46cc76d6c494cdda62a0d5e10c6473231055f018`** and **`013b35ac06c4b84008689d3f833f35`**; local pure Node tests: **9/9 PASS, 0 fail, 0 skip**, including the additional mandatory Origin/Referer denial marker. The actual final branch may have advanced to fourteen markers after those hashes; verify the **latest exact head** before using these receipts.
- These are local helper/runtime-with-mock and pure validator tests. Neither native Mac full-source HTTP+PostgreSQL at B0-96 exact head nor native Windows browser/HTTP acceptance is claimed. The full server/supertest regression suite remains to run.

## Native qualification and release blocks

Mac native machine connection via Desktop Commander reached a monthly quota, so do not retry or reconnect while unavailable. Once authorized access is available, run all repository tests and the opt-in synthetic B0-96 macOS probe on a new **owned** private `/private/tmp/bostan-b096` checkout, using locked Node/pnpm dependencies, and verify 14 stages, no timeout, exact session identity, HTTP 401/403/409, bootstrap invariants and safe teardown. Verify there is no owned process left before cleaning any test-owned temp. Windows C was last observed at about 0.323 GiB, well below the B0-91 2 GiB system minimum; never run heavy Windows PG or Chromium until resource guard passes.

Further OPEN gates: real Mac/Windows HTTP/browser, Playwright Chromium, actual free local agent task, reproducible production build, installers, licensing/security. **Bostan PRIVATE, Draft, release NO-GO.**
