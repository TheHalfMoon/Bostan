# B0-97 — Canonical browser Origin header validation and private HTTP proof

Date: 2026-10-28. PRIVATE Bostan engineering, stacked on Draft PR #248 B0-96. No merge to `main`, release, publishing, GitHub Actions activation, paid model inference, or customer data.

## Source-level issue

The B0-96 repaired origin precedence correctly refused a hostile `Origin` despite a trusted `Referer`. A subsequent review of the parser found another contract mismatch: it reused a generic WHATWG URL parser for the **Origin request header**. For example, `new URL("http://localhost:3100/private").origin` produces `http://localhost:3100`. That silently turns a malformed `Origin` header with a path, query, fragment, embedded credentials or non-HTTP scheme into an apparently valid browser origin. This is header-validation hardening; it is **not** evidence of a practical cross-site exploit in browsers that emit properly serialized Origin headers.

## Production fix

- Add `parseBrowserOriginHeader` to `server/src/middleware/board-mutation-guard.ts`. It accepts only canonical bare `http://authority` or `https://authority` strings (case-insensitive scheme and host), rejects CR/LF, usernames/passwords, path/query/fragment, non-HTTP schemes and alternate normalized spellings.
- When `Origin` exists, validate it with this stricter parser and never fall back to `Referer` on failure.
- Preserve the existing `parseOrigin` **for actual Referer URLs with paths and for `PAPERCLIP_PUBLIC_URL` configuration**. Preserve trust-proxy gate, GET/HEAD/OPTIONS and non-browser actor exceptions.
- Expand server Vitest/Supertest test coverage to reject malformed Origin strings even with a trusted Referer, and accept a canonical mixed-case HTTPS Origin on a correctly matched Host. This new native full-suite coverage remains **unexecuted** while authorized Mac/Windows access is unavailable.
- Expand the synthetic-only real macOS localhost PostgreSQL+HTTP QA to send a session-bearing same-host Origin with a forged path plus trusted Referer and require HTTP **403**. Add a 15th exact ordered required proof marker `BOSTAN_MAC_HTTP_NONCANONICAL_ORIGIN_DENIED`; preserve B0-96's 14 existing gates, strict child exit and verified teardown. This native real HTTP path has **not** been executed at B0-97 head.

## Verified local evidence

On local Linux Node **22.16.0**, using the **exact current GitHub source blob** `server/src/middleware/board-mutation-guard.ts` (git blob SHA **`338b8178669645aa5c0545d601a1aa1323ce208d`**), TypeScript transpilation emitted **zero diagnostic errors** and a direct execution of `trustedBoardMutationOrigin` / `boardMutationGuard` with synthetic Request/Response objects passed **20/20 tests, zero failures**. Cases covered: canonical local and mixed-case HTTPS origins, bad path/trailing slash/query/fragment/credentials/FTP, hostile Origin with trusted Referer, opaque Origin, CR/LF, valid Referer fallback only without Origin, forwarded-host denial from direct clients, allowed proxy trust, safe GET and authenticated board-key bypass. This is *direct module execution with mocks*, not Express/Supertest or a native desktop/server E2E.

The private HTTP evidence module `scripts/bostan-private-mac-http-evidence.mjs` and its test file were reconstructed **byte-identically** from the GitHub refs (git blob SHAs **`f5deebb6489f789dc8d5ab9afff44621ecb3e2da`** and **`3aecd7b3481f83d1673007d064572fbd91e8d095`**). The real Node built-in test runner passed **9/9 tests, zero failures/skips** on the complete fifteen-marker proof, including missing/duplicate/reordered/spoofed markers and timeout rejection. No database or network access was required for these unit tests.

## Still required for qualification

The private macOS full HTTP test in a fresh owned checkout of this PR's **exact head** must still pass with all 15 markers, actual session and admin HTTP statuses, `timeout:false`, `macAuthenticatedHttpQualified:true`, `ownedFixtureCleaned:true`, and no orphaned test PostgreSQL. Its full server Vitest/Supertest tests must also pass. The computer connector hit a monthly quota and must not be retried to evade it. Prior B0-93 manually verified real Mac HTTP signup/admin claim/DB shutdown, but does not cover the new B0-97 assertions.

Windows C: was last observed with ~0.323 GiB free (versus B0-91's 2 GiB Windows system volume admission), so heavy Windows PG/HTTP/Chromium must remain blocked until the guard succeeds. Additional pending release gates: macOS/Windows Chromium, authenticated end-to-end UI, real zero-cost local agent, reproducible compiled build, native installers, license and security qualification.

**Bostan remains PRIVATE, Draft and release NO-GO.**