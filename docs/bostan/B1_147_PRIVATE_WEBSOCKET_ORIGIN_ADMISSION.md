# B1-147 — Private WebSocket browser Origin admission and native upgrade fixture repair

**Status:** PRIVATE DRAFT / UNMERGED / RELEASE NO-GO. Stacked on B1-146 Draft PR #403, exact parent `a9a0881f26bff0e15cf191229aa6610593b1dacf`.

## Source-backed security gap

B1-146 validated the raw WebSocket `Host` before upgrade listeners. That alone does not prevent cross-site WebSocket hijacking: JavaScript served from `https://blocked.invalid` can request `ws://localhost:3100/...`; the browser sends a valid `Host: localhost:3100` **and** its foreign `Origin: https://blocked.invalid`. In `local_trusted`, `server/src/realtime/live-events-ws.ts` can authorize implicit board identity without a bearer token. A browser Origin check is therefore required at the early private upgrade admission boundary. This is a source-backed risk, not a claim of a successful browser exploit or customer-data access.

An independent test reliability defect also existed in the checked-in B1-146 raw HTTP upgrade regression helper: the source contained literal `\\r\\n` text instead of CRLF escape sequences `\r\n`. A real native Debian Linux Node v22.16.0 loopback `node:http` / `node:net` probe showed the literal-backslash request receives **HTTP 400** without an upgrade event, while the properly framed request reaches the upgrade handler and receives **HTTP 101**. The authored tests could not qualify the intended listener path with the previous framing.

## Test-first changes

- Correct the eleven double-escaped CRLF sequences in the raw WebSocket upgrade fixture. Keep the test listener response and client handshake properly HTTP-framed.
- Add eight parameterized private upgrade Origin cases: foreign, opaque, userinfo-folded, numeric IPv4 alias, duplicate, same-host different development port, equivalent loopback hostname, and absent Origin for nonbrowser clients.
- Add two real raw TCP upgrade regression cases for foreign Origin rejection and same-host development Origin acceptance.
- In `server/src/middleware/private-hostname-guard.ts`, require a present browser Origin to be an unambiguous single `http(s)://authority` with strict canonical host parsing; reject malformed, duplicate, opaque, or foreign Origins before any WebSocket listener. A missing Origin remains supported for native clients; same-host different ports and equivalent loopback names remain supported for development.
- Preserve public-mode behavior, existing raw Host admission, WebSocket authentication, allowed-host configuration, and dependency set.

**Security boundary:** Browser JavaScript cannot arbitrarily forge the Origin header, but nonbrowser clients can. This is CSWSH browser-origin mitigation, **not** a replacement for authentication, listener binding, or agent/tenant authorization. No HTTP Origin/CORS policy is changed.

## Actually executed (model-side Debian Linux Node v22.16.0)

1. **Native loopback HTTP framing reproduction:** literal `\\r\\n` request produced HTTP 400 and zero upgrade callbacks; correctly framed `\r\n` request produced HTTP 101 and one upgrade callback. No Bostan package dependencies were used.
2. **13/13 PASS** using a separate zero-dependency Node `node:test` equivalent implementation of the strict private Host and Origin admission predicates. Cases included the eight authored Origin scenarios plus approved/foreign named host, IPv6 loopback, invalid scheme, and trailing path.
3. **4/4 PASS** using a separate actual Node HTTP upgrade and TCP loopback equivalent harness: foreign Origin 403, same-host development Origin 101, duplicate Origin 403, and absent native-client Origin 101. Two upgrade callbacks admitted; no external network.
4. Read back both edited files from the private GitHub branch. Verified the source regex spelling and that the raw upgrade test helper has **zero** remaining double-escaped CRLF sequences and twelve correct escape sequences (including the optional Origin line).

**Qualification honesty:** The Node probes executed equivalent isolated logic and real native loopback networking, **not** the exact checked-in TypeScript module under the full Bostan dependency graph. The ten authored new Vitest cases, the repaired older B1-146 upgrade cases, full Express/Supertest, TypeScript 7, Node >=24.11, and genuine rootless bubblewrap are **not executed** in the private full checkout. No GitHub Actions checks were enabled or run.

## Remaining gates

- Run source-native `server/src/__tests__/private-hostname-guard.test.ts` with the installed approved toolchain and investigate any failures, especially the raw upgrade framing/Origin path.
- Browser-based CSWSH negative and legitimate cross-port WebSocket journeys, authenticated session/cookie and cloud-proxy Origin semantics.
- Four source-native Linux sandbox suites and four genuine rootless bubblewrap cases; installed Windows/macOS/Linux journeys.
- Windows embedded PostgreSQL repeated forced-crash/no-orphan issue #234; Windows authenticated HTTP/BetterAuth/Chromium issue #237; agent consent/side-effects, tenant privacy, and LICENSE/NOTICE/provenance.

Do not merge main, publish, deploy, run Actions, pack npm, use paid infrastructure or real customer data, delete unowned resources, or remove legally required attributions. **RELEASE NO-GO.**
