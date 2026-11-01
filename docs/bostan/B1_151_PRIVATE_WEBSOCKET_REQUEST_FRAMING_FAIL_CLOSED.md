# B1-151 — Private WebSocket request-framing admission

Status: **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO**. Date: 2026-11-01 Asia/Riyadh.

## Exact parent and scope

Stacked on B1-150 Draft PR #407 at exact parent commit `26130c3ff0414a01e6494eabcb220805d310a66a`. Production changes are limited to `server/src/middleware/private-hostname-guard.ts` and `server/src/http/server.ts`. The existing native-wire test and private Host Vitest suite receive regression coverage. No dependency, network exposure, authentication grant, public-mode policy, or main-branch change.

## Source-backed defect

The prior first private WebSocket admission called `isPrivateUpgradeHostAllowed` and checked the request target, raw Host and browser Origin. It did not inspect HTTP method, body framing or the Upgrade field. Node v22.16.0 actually dispatches `upgrade` for all of the following with `Host: localhost:3100`:

- `POST /api/events/ws` with `Upgrade: websocket`.
- `GET` with `Content-Length: 0`.
- `GET` with `Transfer-Encoding: chunked`.
- `GET` with two Upgrade fields (`h2c` and `websocket`).

The previous Host/Origin predicate would allow each request because its admitted inputs were unchanged. This is a **request-framing ambiguity / downstream-contract gap**, not proof of successful unauthorized WebSocket authentication, credential theft, or exploitation. Individual downstream handlers may independently reject some cases.

## Fix

`isPrivateUpgradeRequestAllowed` is a new first-listener private-mode predicate. It requires method `GET`, exactly one raw `Upgrade: websocket` field (case-insensitive token), and no raw `Content-Length` or `Transfer-Encoding` field, before reusing the existing strict Host/Origin predicate. It rejects malformed raw-header arrays. The HTTP server now uses this predicate before runner, plugin, live-events and terminal listeners. Public mode returns true at this gate as before; downstream handlers retain their existing policies.

The prior exported `isPrivateUpgradeHostAllowed` remains intact for its existing Host/Origin tests. This does not claim to harden HTTP/2, reverse-proxy trust, or nonbrowser authentication.

## Executed local evidence

Debian Linux, Node v22.16.0, real ephemeral loopback HTTP/1.1 TCP requests, model-owned temporary script removed after execution. Six native-parser cases were observed to reach the `upgrade` event, and a narrowly source-equivalent old/new predicate produced **6/6 expected results**:

| Case | Old Host-only admission | New framing admission |
| --- | --- | --- |
| Canonical GET WebSocket | allow | allow |
| POST WebSocket | allow | reject |
| GET with Content-Length | allow | reject |
| GET with Transfer-Encoding | allow | reject |
| GET with duplicate Upgrade | allow | reject |
| GET with conflicting Upgrade fields | allow | reject |

This is **not** execution of the exact checked-in Bostan TypeScript module or installed Bostan server. The newly committed zero-dependency native-wire tests and Vitest tests are authored but **not executed** on the full private checkout. Node >=24.11 may reject some malformed wire cases in its parser before the guard; tests allow either a parser 400 or an explicit guard rejection, never an admitted upgrade.

## Remaining NO-GO gates

Run `node --experimental-strip-types --test scripts/bostan-private-upgrade-wire.test.mjs` on the exact authorized checkout with Node >=24.11, plus the native preflight/docs/UI tests, full Vitest/Supertest and TypeScript7. Genuine unprivileged rootless bwrap sandbox integration, Windows PostgreSQL #234 repeated/stress forced-crash no-orphan, Windows compiled authenticated HTTP/BetterAuth/Chromium #237, installed Windows/macOS/Linux journeys, agent consent/tenant privacy, and legally required LICENSE/NOTICE/provenance review remain open.

No main merge, GitHub Actions, release, npm/docs publication, deployment, paid providers, customer data, or deletion of unrelated processes/files.
