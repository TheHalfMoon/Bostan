# B1-152 — Fail closed on ambiguous WebSocket Connection framing

Status: **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO**. Date: 2026-11-01 Asia/Riyadh. Exact direct parent: #408 B1-151 head `ccebd3a1b182d9c0c4a7b88f38327bfd1f9aa8db`.

## Confirmed Node HTTP/1.1 parser behavior

On an isolated disposable Linux Node **v22.16.0** native `http.createServer` listener, actual loopback TCP requests with `Host: localhost:3100` and `Upgrade: websocket` dispatched to the `upgrade` callback even when `Connection` was:
- Two fields: `Connection: keep-alive` and `Connection: Upgrade`.
- Two conflicting fields: `Connection: Upgrade` and `Connection: close`.
- A comma list `Upgrade, Upgrade`, `Upgrade, close`, or `Upgrade, h2c`.
- A canonical `Connection: Upgrade` or a legitimate single `Connection: keep-alive, Upgrade`.

The exact parent's `isPrivateUpgradeRequestAllowed` inspected method, raw Upgrade fields, Content-Length/Transfer-Encoding, Host, Origin but **did not inspect raw Connection framing**, so allowed-Host requests with ambiguous Connection syntax passed the first-listener admission. This is an early admission contract gap; it is NOT proof of bypassing any actual downstream WebSocket authentication, and handlers may independently reject them.

## Bounded fix

Modify `server/src/middleware/private-hostname-guard.ts` to require exactly one raw Connection field with exactly one Upgrade token, and optionally keep-alive in the same comma list. Empty, repeated, unknown or contradictory tokens fail closed. Existing strict Host/Origin/method/body-framing checks remain unchanged. The guard executes only when private-mode admission is enabled; public-mode WebSocket behavior remains unchanged.

Extend `scripts/bostan-private-upgrade-wire.test.mjs` with **8 authored** real Node wire regression cases, including public compatibility, for a total **29 authored native-wire tests**. The native helper now supports selecting the raw Connection header instead of hard-coding a single field. Extend existing `server/src/__tests__/private-hostname-guard.test.ts` with **6 authored** table-driven predicate cases.

## Executed evidence vs unexecuted qualification

- **Actually executed**: isolated Linux Node v22.16.0 `node:test` with **8/8 PASS**, using a *source-equivalent* new raw Connection predicate and actual native `createServer` / `net.connect` loopback HTTP/1.1 Upgrade bytes. Node dispatched all eight request forms to `upgrade` and the predicate admitted only the two canonical variants. No network access beyond 127.0.0.1; no customer data, provider calls or persistent fixtures.
- **Independently verified**: actual PR #408 parent source from private GitHub has no Connection-field check in `isPrivateUpgradeRequestAllowed`; production source and two test files are updated on this new private draft branch with exact SHA-based GitHub writes.
- **NOT EXECUTED**: complete exact checked-in 29-case native-wire test suite, the 6 new source Vitest cases, full Bostan Node >=24.11 private checkout, TypeScript7, Vitest5, genuine Linux bwrap, Windows PG #234 repeated forced-crash no-orphan, Windows authenticated HTTP/Chromium #237, installed Windows/macOS/Linux, side-effect consent, tenant privacy and LICENSE/NOTICE provenance. Do not infer release readiness from 8/8 source-equivalent tests.

## Safety and compatibility

Do not merge or publish, run GitHub Actions, deploy, enable paid providers, change user databases or remove legally required third-party notices. All changes are scoped to the private draft branch and are intended for subsequent source-native qualification. **RELEASE NO-GO**.
