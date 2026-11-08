# B1-150 — Native HTTP/1.1 WebSocket upgrade admission qualification

Status: **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO**. Date: 2026-11-01 Asia/Riyadh.

## Parent and scope

Parent: Draft PR #406, branch work/b1-149-exclude-ipv6-unspecified-bind-host, exact head e66eb321bfb05bc23a30d07b81220cec31e45bec. The tested middleware is the actual TypeScript source at server/src/middleware/private-hostname-guard.ts, Git blob 76cbb0f257f45cf5b7519d3f18ee05632723420a (verified locally with git hash-object against the private GitHub blob).

This change adds a **zero-dependency native-wire regression suite** in scripts/bostan-private-upgrade-wire.test.mjs. It does not alter production code, authentication, the HTTP listener, the proxy trust policy, or release controls.

## What the test exercises

A local ephemeral 127.0.0.1 Node HTTP server receives raw HTTP/1.1 Upgrade requests over TCP. Node parses the requests into real IncomingMessage objects. The test imports and invokes the **checked-in Bostan** isPrivateUpgradeHostAllowed function. A deliberately minimal upgrade responder emits HTTP 101 only for admitted requests; denied requests destroy the socket.

Sixteen cases cover:
- Valid private Host with absent Origin, matching Origin, and loopback-alias Origin.
- Rejected foreign Host, forged X-Forwarded-Host, foreign/opaque/legacy-numeric Origin, duplicate Origin and Host, Host userinfo, Origin path, and Latin-1 obs-text Host.
- IPv6 unspecified bind (::) refusing [::] Host.
- Explicitly approved non-loopback Host with matching Origin.
- Existing public-mode behavior.

This validates the **real Node HTTP parser plus the real TypeScript admission function**; it does **not** use a real Bostan authenticated WebSocket server, Express, BetterAuth, Vite, or browser.

## Exact source-native execution

Runtime: Debian Linux, Node v22.16.0, command: node --experimental-strip-types --test scripts/bostan-private-upgrade-wire.test.mjs. The **exact committed test file** and exact middleware Git blobs were reconstructed into an isolated local fixture and checked with git hash-object against the private GitHub blob SHAs: test **75dc5bb6e04e7d40232fd4664f6128b26a7487c5**, middleware **76cbb0f257f45cf5b7519d3f18ee05632723420a**. The exact source-native suite then yielded **16/16 PASS**, zero failures, on real loopback TCP. This is not an installed Bostan server or a full repository test.

The suite still needs an independent rerun in the authorized full private checkout using Node >=24.11. The exact blob verification here applies to the two isolated source files only, not the entire checkout.

## Remaining NO-GO gates

Full private checkout, native preflight/docs/UI, installed Vitest/Supertest, TypeScript 7, four mandated Linux sandbox tests and four unprivileged rootless bwrap integration cases, Windows PostgreSQL #234 repeated stress/forced-crash no-orphan, compiled authenticated HTTP/BetterAuth/Chromium #237, installed Windows/macOS/Linux journeys, consent/tenant isolation, and legal LICENSE/NOTICE/provenance review remain open.

No main merge, GitHub Actions, release, deployment, publication, paid service, customer data, or unrelated file/process deletion.
