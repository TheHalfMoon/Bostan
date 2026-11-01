# B1-154 — Private WebSocket Connection token lexical admission

Status: PRIVATE DRAFT ONLY. NOT release-qualified. Parent: B1-153 PR #410 at `430ff5418b700b1aeab7500aa8cfd4c164caadad`.

## Source finding and bounded change

The private WebSocket admission introduced by B1-152 split the raw `Connection` field on commas and applied JavaScript `String.trim()`. That operation accepts Unicode whitespace, including Latin-1 non-breaking space (0xA0), although HTTP optional whitespace is ASCII SP/HTAB. The same logic checked that `Upgrade` occurred exactly once but permitted repeated `keep-alive` tokens. These spellings are ambiguous or noncanonical at the raw HTTP upgrade boundary.

On local Debian Linux Node 22, a genuine loopback TCP HTTP/1.1 request containing either `Connection: Upgrade, keep-alive, keep-alive` or `Connection: Upgrade,<NBSP>keep-alive` was dispatched to the server's `upgrade` event, with the raw field preserved. The old admission predicate accepted both. The changed predicate strips only ASCII SP/HTAB around tokens and rejects repeated `keep-alive`; it still accepts one `Upgrade` with an optional single `keep-alive`, including valid ASCII tab OWS. Public-mode behavior remains unchanged.

## Tests and evidence bounds

- Added three direct Vitest regression cases to `server/src/__tests__/private-hostname-guard.test.ts` for duplicate keep-alive, Latin-1 NBSP and legitimate tab OWS.
- Added three genuine TCP upgrade-wire regression cases to `scripts/bostan-private-upgrade-wire.test.mjs`.
- In an isolated, temporary Linux Node 22 built-in test harness, executed **9/9 PASS, 0 fail/skip**: seven source-equivalent old-versus-new lexical cases and two real loopback HTTP/1.1 upgrade-dispatch probes. The two rejected raw header spellings reached Node's `upgrade` callback. The temporary harness was removed.
- **NOT RUN:** the checked-in TypeScript module under the complete authorized Node >=24.11 checkout, the 32-case native wire suite, Vitest/Supertest, TypeScript 7, sandbox Vitest5, rootless bwrap, Windows PostgreSQL #234, Windows authenticated packaged #237, or installed cross-platform journeys.

This is a limited HTTP framing consistency fix; it does not establish authenticated WebSocket safety or complete server qualification. Keep PR Draft and unmerged. No GitHub Actions, releases, deployments, paid services or customer data.
