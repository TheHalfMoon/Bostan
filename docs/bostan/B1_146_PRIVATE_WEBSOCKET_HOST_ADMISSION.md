# B1-146 — Private WebSocket Host admission before upgrade listeners

Status: **PRIVATE DRAFT / UNMERGED / RELEASE NO-GO**. Based on B1-145 Draft PR #402 at exact parent `06f524428974320a190f0841f47bfcd8ad47a9ca`.

## Source-backed security gap

The private-mode HTTP `privateHostnameGuard` in `server/src/app.ts` runs as Express middleware. Node's HTTP `upgrade` event does **not** invoke the ordinary HTTP request listener. At the parent revision, `server/src/http/server.ts` installed WebSocket listeners without a corresponding private Host admission. The live-events upgrade handler in `server/src/realtime/live-events-ws.ts` performs authorization, but local-trusted mode can authorize the implicit board identity without a bearer token; it did not independently validate raw Host or a browser Origin. This leaves a DNS-rebinding / cross-origin WebSocket risk requiring full runtime security qualification. No actual browser exploit or customer-data access is claimed.

An isolated Debian Linux Node v22.16.0 native `node:http` probe reproduced the event-dispatch boundary: an HTTP request with `Host: blocked.invalid` was refused with HTTP 403 by the request listener, while the same blocked Host on an `upgrade` event reached a test-owned WebSocket-like handler and received HTTP 101. This was a minimal Node server, **not** the full Bostan application.

## Test-first correction

- Exported `isPrivateUpgradeHostAllowed` from `private-hostname-guard.ts` to reuse strict raw Host counting, forged X-Forwarded-Host refusal, origin-form request target, and the same allow set as HTTP. Public mode is unchanged.
- `createPaperclipHttpServer` now accepts optional private Host admission and installs its rejecting upgrade listener **before** runner and plugin WebSocket listeners. It marks rejected upgrades handled and destroys the socket, rather than entering any authentication or WebSocket handshake.
- Production `server/src/index.ts` supplies the same private-mode enablement, allowed hostnames and bind host as `createApp`.
- The custom-image terminal upgrade listener now honors the existing `paperclipWebSocketHandled` flag. Runner PRP, plugin API, and live-events listeners already honor this flag.
- Added checked-in Vitest/Supertest source tests for five refused authority cases, allowed and public-mode cases, plus real Node HTTP listener upgrade probes. **These checked-in Bostan tests are authored, not executed in the full checkout.**

Frozen GitHub blobs for this branch after code/test changes:

- `server/src/middleware/private-hostname-guard.ts`: `672210e5d380a34391f7c298da299bc1bd8fd51a`
- `server/src/http/server.ts`: `b3c8cb5a947307276e5a25e45adc12f35bb2e9fc`
- `server/src/index.ts`: `5424c73cfafe94b9abf1c4496e8825444e20ff50`
- `server/src/realtime/environment-custom-image-terminal-ws.ts`: `6657bbd29fb6c9d977d15a81a7839d63548e5e59`
- `server/src/__tests__/private-hostname-guard.test.ts`: `bb64bd6bb8b8c28a16eaee781ef0e956d20f823c`

## Actually executed evidence (2026-11-01)

An isolated model-owned Linux `/tmp` harness ran the same admission predicates and `node:http` upgrade listener ordering with loopback-only sockets. Node v22.16.0 built-in `node:test` reported **11/11 PASS**, zero failures: five denied authority cases, two allowed private Host cases, disabled-mode compatibility, denied upgrade never reaching a downstream handler, allowed loopback upgrade, and public-mode compatibility. This harness uses copied equivalent logic, **not** the exact checked-in TypeScript module or Bostan HTTP server. No paid services, downloads, customer data, GitHub Actions, or user-machine access.

## Remaining qualification and release blockers

On an authorized private owner-marked checkout with preinstalled Node >=24.11 and dependencies, execute the exact `server/src/__tests__/private-hostname-guard.test.ts` and all WebSocket suites, TypeScript7 typecheck, Linux four native Vitest5 suites and four genuine rootless bubblewrap cases. Test live-events, terminal, plugin API and runner PRP upgrades under blocked/allowed Host and authenticated/local-trusted/public configurations; verify browser Origin/CSWSH behavior, cookie/session constraints and no listener-order regressions. Installed Windows/macOS/Linux journeys, Windows PostgreSQL issue #234, authenticated Windows HTTP/Chromium #237, agent consent, privacy/tenant isolation, and required third-party LICENSE/NOTICE/provenance remain unqualified.

No main merge, publication, deployment, release, Actions enablement, paid infrastructure, unowned cleanup or legal attribution removal.
