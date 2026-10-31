# B1-109 — Prevent HTTP proxy credentials from reaching origin servers

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, zero-cost, no deployment/release/publishing.** Parent B1-108 private Draft PR #364 exact head `cb11b55c5e1f405a887eb867fe235104fd3df6eb`.

## Source issue

`packages/adapter-utils/src/local-process-sandbox.ts`, `startNetworkAllowlistProxy` HTTP forward path, previously called `http.request(target, { method, headers: { ...request.headers, host: target.host } })`. Node's incoming HTTP headers contain `proxy-authorization` and `proxy-connection` in lowercase. Those headers belong to the **client-to-proxy** hop, not to the origin server. The unfiltered spread forwarded them to any destination otherwise permitted by the sandbox network allowlist; `Proxy-Authorization` may contain a secret. The upstream `Authorization` header, by contrast, is a legitimate origin credential and must be retained.

## Repair

New exported helper `buildLocalProcessProxyOriginHeaders(incoming, targetHost)`: shallow-clone headers, force the destination `Host`, remove `proxy-authorization` and `proxy-connection`, preserve destination `authorization` and unrelated headers; never mutate original request. The HTTP forwarding call now uses the helper. Explicit provenance of type surface is Node `http.IncomingHttpHeaders` to `http.OutgoingHttpHeaders`. No sandbox mount changes, upstream host-allowlist widening, network privileges, dependencies, external services, client data, cloud calls, or changes to CONNECT tunnel handling.

Changes: test-first commit `94bafdb8491dda87e8e6e960ec8f226bc4ec184e`; production source commit `ae2e394eaa7455d53f68c9f97662365e47705d7c`. Added two regressions in `local-process-sandbox.test.ts`: a cross-platform pure helper assertion for removed proxy secrets, retained origin Authorization and unchanged input; and a **Linux-only source proxy integration** using a loopback origin, owner-isolated proxy socket, `Proxy-Authorization`, `Proxy-Connection` and distinct origin Authorization, then checking received origin headers and safe cleanup. The Linux-only Vitest test is **not executed yet**.

## Evidence actually executed: source snippet and localhost Node HTTP, not full package

Native Debian Linux / Node v22.16.0 in a model-side ephemeral working container, no external network or user data:

1. Independent old/new HTTP proxy reproduction with **synthetic test-only** `Proxy-Authorization` and `Proxy-Connection`: original header copy forwards both to loopback origin (**RED**); deleting both removes them, while preserving distinct origin Authorization and destination Host (**GREEN**), **2/2 expected observations PASS**.
2. Extracted the **exact newly committed TypeScript helper** returned by GitHub at source commit `ae2e394e...`; executed it with `node --experimental-strip-types`, then ran a synthetic loopback HTTP proxy using that exact helper and `http.request` forwarding. `SOURCE_HELPER_PURE_PASS`, `SOURCE_HELPER_LIVE_LOOPBACK_HTTP_PASS`, exit 0. Tests confirm proxy credentials absent and legitimate origin Authorization/Host retained. Test-only source and local servers deleted/closed.
3. The two new checked-in Vitest tests, the package-wide TypeScript typecheck, actual `bubblewrap` enforcement, full adapter-utils test suite, Windows/Mac installed app and release qualification **WERE NOT RUN**. **Never claim these as passed.** At time of work, the Mac/Windows Remote Desktop Commander was at its monthly quota and refused further calls; do not retry or bypass that limit. GitHub Actions intentionally disabled, no paid provider/runner.

The model-side reproduction directly tests the exact helper but not the full Bostan module. This change is a **code fix requiring full source-native qualification** before merging/releasing.

## Remaining risk and release posture

B1-108 #364 addresses WHATWG URL default-port normalization suffix widening; B1-107 #363 bounds CONNECT ports; B1-106 #362 preserves pinned network ports. Entire Bostan product **NO-GO** pending actual native installed apps for Windows/macOS/Linux, full real Linux bwrap tests, combined adapter-utils integration/typecheck, explicit approval and effect containment, tenant security/privacy, sustained real PostgreSQL concurrency, and third-party upstream licenses, NOTICE and provenance. Keep **private Draft PR**, no merge to main, Actions, publishing, release, deployment, npm pack, paid models/cloud, customer data, or deletion of unowned files.
