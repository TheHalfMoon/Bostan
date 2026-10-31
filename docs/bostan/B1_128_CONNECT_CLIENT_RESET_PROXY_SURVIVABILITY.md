# B1-128 — Keep the long-lived Linux CONNECT proxy alive after client TCP resets

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / DRAFT / UNMERGED / ZERO COST / NO RELEASE**.
Direct parent: B1-127 private Draft PR #384 exact HEAD `83c5c7c630b345a6a532756bd7a60ffbe9f5cdea`.

## Confirmed live-process crash

The allowlisted network proxy's HTTP `CONNECT` handler attaches `upstream.on("error", ...)` and `clientSocket.on("close", ...)`, but **never subscribed to `clientSocket.on("error", ...)`**. When a client cancels an active tunnel using a TCP RST, Node can emit `ECONNRESET` on the accepted `net.Socket`. An `error` event without a listener is an uncaught EventEmitter exception: **the entire long-lived proxy process terminates**, potentially interrupting other sandboxed agents.

Actual bounded local verification on native Debian Linux with **Node v22.16.0**, isolated listeners on `127.0.0.1` only:
- **RED (original handler equivalence):** Node `http.createServer().on("connect")`, an allowed local TCP origin, request with a real HTTP/1.1 CRLF CONNECT prelude, client `resetAndDestroy()` after 20 ms. The host Node process **exited with code 1** and emitted `Unhandled 'error' event`, `Error: read ECONNRESET`, `Emitted 'error' event on Socket instance`. No external network requests.
- **GREEN (same handler plus one client-socket error listener):** the controlled regression issued **eight** consecutive abrupt client TCP resets, then opened a fresh valid CONNECT tunnel on the same proxy. The process survived; its final JSON result was `{"resets":8,"canStillConnect":true}` with successful exit. The local ephemeral scripts were removed.

This is a **real Node socket-lifecycle reproduction of the exact missing listener behavior**; it is **not** a source-native execution of the full private Bostan TypeScript module or a production installation, and it is not an evidence of an agent exfiltration or sandbox namespace escape.

## Actual private GitHub changes

**New Linux-only source-native Vitest regression first**, commit `a7c9f451a203e12ce72cd861d6d4c3c4853142d0`: `packages/adapter-utils/src/local-process-sandbox.test.ts` now creates its own localhost TCP origin, constructs the actual Bostan sandbox proxy with only a synthetic allowlisted localhost port and an owned temporary workspace, opens **three** allowlisted CONNECT clients and calls `client.resetAndDestroy()` on each, then asserts that a subsequent authorized CONNECT still yields `HTTP/1.1 200 Connection Established`. All connections and only test-owned temp resources are cleaned. The Vitest test was committed but **NOT RUN in source-native Bostan Vitest** during this turn.

**Minimal production source fix**, commit `c05bf4da59d127803f50b95cb991cadbe2940241`: in the already existing `server.on("connect")` handler, immediately after `upstream.on("error", () => clientSocket.destroy())`, add `clientSocket.on("error", () => upstream.destroy())`. The existing `clientSocket.on("close", () => upstream.destroy())` remains. This prevents unhandled client-side `ECONNRESET` and tears down the corresponding origin TCP connection instead of retaining an unused tunnel. It does not broaden network allowlist rules or privileges, use cloud services, change dependency versions or create any remote write.

**Identity lock:** independently re-fetched both modified files from the private GitHub head:
- Production `packages/adapter-utils/src/local-process-sandbox.ts`: exact Git blob `33c6e4fefeb57db2e856ad3e97a43cb3801743f1`.
- Linux regression `packages/adapter-utils/src/local-process-sandbox.test.ts`: exact Git blob `a44f46d119f7e3b06b30d0cb63cdbb78b0cfff80`.

Both identities are now frozen in the fail-closed `scripts/bostan-private-linux-sandbox-gate.sh` at commit `35f816093d42388c3b40be1fce1a35294e47b75a` and documented in `docs/bostan/B1_112_LINUX_SANDBOX_SOURCE_NATIVE_GATE.md` at commit `b012f9f7ad7e9d7246185ef944d0a53edb3ebe8e`. Previous B1-126 protection of all four selected test-suite Git blobs and prior B1-124/125 JSON audit requirements remain unchanged.

## Qualifications still open

**NOT EXECUTED:** the checked-in new Linux Vitest case itself, Bostan source-native four-suite Vitest5/TS7, genuine unprivileged bubblewrap, the entire 16-case B1-126 synthetic admission script, platform-installed Windows/macOS/Linux product, long-running agent side-effect and consent checks, actual sustained PostgreSQL stress issue #234, privacy/tenant isolation, and full third-party license/NOTICE/provenance audit. The model runtime only has Node22, no actual Bostan private checkout/Node>=24.11/TS7/bwrap. Desktop Commander previously returned an explicit monthly quota exhausted / do not retry result; no further remote connection attempt was made.

## Next strict release gate

Use only a **separately authorized disposable private native Linux QA checkout** at the exact new PR HEAD with preinstalled Node >=24.11, Vitest, TS7, rootless bubblewrap and enough resources. Execute `node --test scripts/bostan-private-linux-vitest-report-audit.test.mjs`, `bash scripts/bostan-private-linux-sandbox-gate.test.sh` (16 expected admission refusals/passes), and `bash scripts/bostan-private-linux-sandbox-gate.sh --run` (all four source-native suites including this new real CONNECT TCP reset case, all four mandatory rootless cases, and adapter-utils TypeScript check). Capture actual logs and treat any nonzero or skipped test as NO-GO. Then qualify installed cross-platform products, governed agent effects, real PG stress, tenant privacy and third-party notices.

**Overall Bostan release remains NO-GO.** Keep repository PRIVATE, Draft PR UNMERGED, main unchanged, Actions disabled; never publish/deploy/release, use paid cloud or customer data, modify unowned files or remove required third-party license notices.
