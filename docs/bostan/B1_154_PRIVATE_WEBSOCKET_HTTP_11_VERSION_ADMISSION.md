# B1-154 — Enforce HTTP/1.1 before private WebSocket Upgrade listeners

Status: **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO**. Date 2026-11-01 Asia/Riyadh. Direct parent: PR #410 at exact commit `430ff5418b700b1aeab7500aa8cfd4c164caadad`.

## Confirmed source-backed gap

At parent source blob `d16e79c698de5757e260b1265cbf3e3d181e8733`, `isPrivateUpgradeRequestAllowed` verified GET, raw Upgrade and Connection fields, lack of HTTP body framing, private Host and Origin, **but not HTTP protocol version**. Node.js 22.16.0's native HTTP/1 parser emits the `upgrade` event for **HTTP/1.0 and HTTP/2.0 request lines** carrying otherwise canonical WebSocket headers. A private Bostan first-listener check would admit those requests on an approved localhost Host (downstream WebSocket handlers may still reject them). This is a protocol-admission gap, **not evidence of a bypass of downstream user authentication or production exploitation**.

## Minimal repair

- Require `req.httpVersion === "1.1"` before any private request reaches WebSocket listeners. Keep the preexisting public-mode early return; preserve all Host/Origin/header/other private checks.
- Widen the exported predicate's TypeScript `Pick<IncomingMessage>` with `"httpVersion"`; production Node IncomingMessage provides that field.
- Update direct Vitest test objects to supply `httpVersion: "1.1"` and add six authored predicate cases: four incorrect versions (`1.0`, `2.0`, empty, `1.2`), canonical `1.1` acceptance, public-mode `1.0` compatibility.
- Extend the actual raw TCP `scripts/bostan-private-upgrade-wire.test.mjs` helper to select an HTTP request-line version and add three authored Node native-wire cases: deny `1.0`, deny `2.0`, public-mode `1.0` compatibility. The aggregate authored wire suite is now **32 tests** (29 prior +3).

## Executed evidence

**Actual isolated Linux Node v22.16.0 TCP parser experiment** using an owned ephemeral `node:test` file, `createServer`, `net.connect` and HTTP/1.0, HTTP/1.1, HTTP/2.0 raw wire requests:

- Original source-equivalent predicate (no protocol check) allowed all three; observed `req.httpVersion` matched each request-line string.
- Fixed source-equivalent predicate denied HTTP/1.0 and HTTP/2.0, allowed HTTP/1.1, with no external access.
- **3/3 native Node test cases PASS, 0 fail, 0 skipped**; owned temporary directory removed.

The tested predicate was **source-equivalent**, **not** a source-native import from the exact checked-in Bostan repository. The 3 new committed native-wire tests and 6 new committed Vitest tests have been authored but **not run** on the full private checkout. Source is in GitHub and independently auditable.

## Remaining mandatory qualification

On an authorized full private checkout with Node >=24.11 and pinned installed dependencies, run `pnpm run test:bostan-admission`, `pnpm run test:bostan-upgrade-wire`, `pnpm run test:run`, TS7 and all genuine rootless bwrap/Linux sandbox tests. Continue Windows PostgreSQL force-crash/no-orphan #234, actual Windows authenticated server/HTTP/Chromium #237, complete installed OS journeys, consent and tenant isolation, legal provenance. Do not claim release-ready until those tests pass.

No main merge, GitHub Actions, deployment, npm/docs publication, paid services, real customer data, foreign file/process cleanup or deletion of legally required notices. **RELEASE NO-GO.**
