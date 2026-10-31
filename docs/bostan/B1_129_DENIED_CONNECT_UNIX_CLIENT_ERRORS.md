# B1-129 — Denied CONNECT clients must never crash the long-lived proxy

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / DRAFT / UNMERGED / ZERO COST / RELEASE NO-GO.**
Stacked on B1-128 private Draft #385 exact HEAD `9e8147412d187d2407b5978c048095ecde045dd7`.

## Confirmed residual crash in the denied CONNECT branch

B1-128 added an `error` handler to the **allowed** HTTP CONNECT tunnel, but the deny branch of `server.on("connect")` still called `clientSocket.end(connectProxyError(...))` then returned **without an `error` listener**. A rejected client may abort while the 403 is being written; the accepted socket then emits `ECONNRESET`. In Node.js, an unhandled Socket `error` terminates the **whole long-lived proxy process**.

Independent *actual executable* reproductions, on Debian Linux Node v22.16.0 with only local loopback / owned temporary paths:

- **TCP rejected CONNECT RED:** a localhost HTTP CONNECT server implemented the exact early-403-without-listener branch; an unauthorized CONNECT from a TCP client followed by `resetAndDestroy()` caused `Unhandled 'error' event`, `read ECONNRESET`, exit status **1**.
- **Unix domain socket rejected CONNECT RED (more representative):** same rejected branch through an owned temporary `.sock` endpoint, abrupt `client.destroy()` after a real CRLF CONNECT; crashed `read ECONNRESET`, exit **1**.
- **Unix domain socket GREEN:** a handler added the minimal `clientSocket.on("error", () => clientSocket.destroy())` before replying 403; same local test executed **100 abrupt client disconnections** followed by a normal denied CONNECT with a 403 status line, emitted `{"disconnections":100,"laterPolicyResponse":true}`, and exited successfully.
- **TCP GREEN companion:** same handler change handled **100** denied TCP client resets then accepted a later authorized CONNECT, emitted `{"deniedResets":100,"nextAuthorizedConnect":true}`, exit 0.

This is native Linux Node networking under the identical handler pattern, not an actual full private Bostan source-native Vitest or installed product run. No external network, cloud, privileges, customer data or paid services. Only test-owned `/tmp` files were created and removed.

## Critical correction to B1-128 checked-in regression

The real `startNetworkAllowlistProxy` listens on an **AF_UNIX socket**. The previously committed B1-128 test used `client.resetAndDestroy()` against that Unix socket, which Node v22 **throws `ERR_INVALID_HANDLE_TYPE`** for. This is a defect in the previous test, independent of the production proxy.

Model-side real local Node Unix-socket test confirmed `resetAndDestroy()` throws `ERR_INVALID_HANDLE_TYPE`. B1-129 corrects the B1-128 checked-in test to `client.destroy()`, and its title/comment now accurately describe an abrupt **Unix client disconnect**, not a TCP RST. As independently reproduced, abrupt Unix disconnects can still generate `ECONNRESET` on the proxy's receiving accepted Unix socket.

## Actual private GitHub code and regression

**Test-first** `packages/adapter-utils/src/local-process-sandbox.test.ts`, commit `4a570993522f6513b8ef2c9fe4338050435f052b`:
- Correct B1-128 allowed CONNECT Unix-socket regression to use `destroy()` instead of TCP-only `resetAndDestroy()`.
- Add a Linux-only regression `survives denied CONNECT client disconnects and serves a later policy response`: builds the actual Bostan allowlisted proxy at its socket path using an owned synthetic workspace, submits 12 denied CONNECT requests, drops Unix socket clients immediately, then verifies the **same** proxy still replies `HTTP/1.1 403 Forbidden` with `network_target_denied` on a fresh request.
- The new test is committed, **not source-native run** under full Bostan Vitest. Do not represent the 12 steps as measured by this checked-in test yet.

**Production fix** `packages/adapter-utils/src/local-process-sandbox.ts`, commit `eaff1e8c851926da62255c5bb775006252204052`: before the denied CONNECT `clientSocket.end(...)`, register `clientSocket.on("error", () => clientSocket.destroy())`. Allowed CONNECT retains B1-128 `clientSocket.on("error", () => upstream.destroy())`. Keeps policy refusal unchanged; only prevent process termination when a rejected peer disconnects.

**Exact GitHub blob identity** fetched from the actual private candidate:
- Source blob `f2a4c0b8591d60a9d6fbba59fc2db7310fd82e62`.
- Test blob `a8e3ded1cb0bdf163150dc28e856fb4e52464d71`.
- The Linux source-native QA script `scripts/bostan-private-linux-sandbox-gate.sh` was repinned to both identities at commit `2ac8ce9e1aa64d20ffb787418919743844acee78`.
- The B1-112 historical gate explanation was updated at commit `1c21b24a7d452b728c68e8e992036120169c8122`.
- These revisions retain the previous frozen identities of the three other native Vitest suites and the JSON audit verifier; no dependencies or permissions change.

## Qualification and release boundaries

**Actually executed:** separate bounded Linux Node22 TCP/Unix red/green crash reproductions described above; modified logic demonstrably survives 100 denied-client disconnects on each transport and remains responsive. Temporary files under model-owned scratch paths cleaned.

**Not executed:** Bostan's checked-in new source-native Vitest case and corrected B1-128 case, full four-suite Vitest/TS7, rootless bubblewrap, B1-126 16-case synthetic admission test, installed Windows/macOS/Linux product, controlled agent effects and consent, sustained real PostgreSQL stress issue #234, tenant isolation/privacy and third-party licenses/NOTICE/provenance. Remote Desktop Commander previously returned monthly quota exhausted with explicit DO NOT RETRY; no remote session attempted.

**Next required gate:** use an authorized, disposable, private Bostan native Linux checkout at the precise PR HEAD, with preinstalled Node>=24.11, Vitest5, TypeScript7 and working rootless bubblewrap. Execute `node --test scripts/bostan-private-linux-vitest-report-audit.test.mjs`, `bash scripts/bostan-private-linux-sandbox-gate.test.sh` (16 synthetic cases) and `bash scripts/bostan-private-linux-sandbox-gate.sh --run` (all four source-native suites with both CONNECT regressions, four real rootless isolation cases, TS7). Report actual failures, do not waive requirements. Installed cross-platform apps, governance, security/performance and license audit remain mandatory.

**Overall Bostan release: NO-GO.** Keep GitHub PRIVATE, PR DRAFT and UNMERGED, main unchanged, Actions disabled. No publish/deploy/release/npm pack/paid services/customer data/unowned cleanup or removal of upstream required attribution.
