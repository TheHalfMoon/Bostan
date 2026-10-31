# B1-138 — Private Host authority spoofing boundary

Status: PRIVATE / ZERO-COST / DRAFT UNMERGED / NO RELEASE. Exact parent is private PR #394 head 217e615646c557fa340e610630601e1ec70f39f0. No main merge, release, npm publish, deployment, user-data mutation, or license/NOTICE removal.

## Confirmed exploitable-by-design trust error (source-level)

At the exact parent GitHub source `server/src/middleware/private-hostname-guard.ts` (blob 15843cbfe2fb3d8de4c2e582ada40d95e42cd10e), `extractHostname` chose `X-Forwarded-Host` **before** actual `Host`, without authenticating a reverse proxy. This is relevant to private exposure; the guard is enabled for authenticated/private and local_trusted/private per `server/src/app.ts`.

The old function fed the value to `new URL("http://" + raw)` and compared its normalized hostname to loopback/allowlist values. A Node 22.16 source-equivalent reproduction, with no Bostan server launched, confirmed:
- `Host: blocked-host.invalid:3100` + `X-Forwarded-Host: localhost:3100` produced `localhost`, yielding a **false allow**.
- `Host: malicious@localhost:3100` produced `localhost` (WHATWG URL treats the first portion as userinfo), **false allow**.
- `Host: localhost:3100/admin` produced `localhost` (unwanted URL path), **false allow**.
- Canonical `Host: [::1]:3100` produced `[::1]`, while existing loopback policy recognizes only `::1`, **false deny**.

No actual remote exploit, server, network effect, production service or deployed app was accessed.

## Minimal backward-conscious repair

Added exported pure `parsePrivateHostHeader(value)` that accepts only canonical Host authorities, rejects userinfo, paths, query fragments, backslashes, percent escapes, control characters and malformed or noncanonical ports, fails closed on URL parsing errors and normalizes bracketed IPv6 for comparison. The guard now uses **only** `Host`, not unverified `X-Forwarded-Host`. A trusted reverse proxy must preserve Host or use an explicitly allowed backend hostname; global Express `TRUST_PROXY` is never evidence that a client-supplied forwarded host is safe. Existing hostname allow-set, disabled mode, error redaction, and all unrelated runtime logic are unchanged.

Extended existing Vitest + Supertest regression suite with two spoofed-forwarded-header tests, seven parameterized malformed-Host tests, canonical IPv6 acceptance, explicitly configured hostname acceptance despite forged forwarded header and missing-Host denial even with forwarded localhost.

## Execution record and limits

- Node 22.16.0 native built-in test runner on an isolated **source-equivalent parser** exercised **13/13 cases PASS**; no dependencies or networking required. The first native Node test invocation incorrectly discovered unrelated installed tests; those were NOT product tests and their errors were excluded; re-ran with an explicit isolated test filename, **13 pass, 0 fail**. Temporary fixture was removed.
- The original vulnerable `extractHostname` was also reproduced in native Node 22 with three **false allow** cases and one IPv6 **false deny**. The source was inspected from exact private GitHub parent before patching.
- New full `server/src/__tests__/private-hostname-guard.test.ts` Vitest + Supertest integration tests are **authored but NOT RUN**, pending an authorized full source checkout with Node>=24.11 and preinstalled pinned deps. No native Windows/Linux/macOS installed app or real HTTP server/PG/Chromium qualification has been performed. Do NOT close #237 from this bounded finding.

## Remaining gates

Native Node>=24.11 Vitest5, TypeScript7 strict, rootless bwrap, full authenticated HTTP/Chromium on Windows (#237), forced-crash and repeated real Windows PostgreSQL no-orphan (#234), agent consent/effects and cross-tenant privacy tests, installed OS and legal provenance/NOTICE qualification. Product RELEASE NO-GO.
