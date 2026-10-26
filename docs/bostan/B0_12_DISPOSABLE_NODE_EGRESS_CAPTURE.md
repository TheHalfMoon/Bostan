# B0-12 — Test-only Node server outbound network gate for disposable source QA

Private Bostan development, 26 October 2026. Stacked Draft on B0-11 PR #160. Do not merge to main, deploy, publish, enable Actions, spend model credits or alter any user application, process or source-license notices.

## Missing B0-05 (issue #30) evidence

B0-11 protects HTTP, popups and WebSockets in a disposable Chromium context. It cannot see network requests made by the Bostan CLI, Node backend and Node children outside Chromium.

An explicitly opted-in source QA Node preload now instruments recognized global fetch, built-in Node HTTP/HTTPS request/get, HTTP/2 connect, TCP net connect/createConnection, TLS connect and global WebSocket constructor. Calls are admitted only to localhost, 127.0.0.1, ::1 or local Unix socket paths. If the attempted destination is external or ambiguous, the guarded API fails before the request; it writes ONLY a fixed category (fetch/http/http2/tcp/tls/websocket), never a URL, credential or payload, into the private disposable HOME audit file. A marker called armed is written at preload activation.

The hook is NOT loaded by production code. It runs ONLY if synthetic smoke flag BOSTAN_TEST_ONLY_NODE_EGRESS_PROFILE=1 is present. The disposable source launcher creates a new temporary HOME, installs a Node preload flag in the child and reuses it for the server's restarted Node process. It fails admission if any real remote-model or governed Case provider experiment is enabled. The existing parent verifies at least TWO armings, one per server start, and ZERO blocked-network categories before declaring a passing smoke. A blocked API that the server catches still fails qualification through the receipt.

## Actual evidence

- Focused classifier/preload and source admission tests: 17 PASS, 0 FAIL.
- Real separate Node subprocess with guard opt-in: rejects http.request, https.get, http2.connect, net.connect, tls.connect and fetch against synthetic.invalid before any remote request, while admitting a loopback HTTP request. The private receipt records category only and test deletes its uniquely generated HOME.
- Actual macOS source Bostan private app, PostgreSQL company create/persistence, clean stop/restart and headless Chromium under BOTH guards: PASS. Result has nodeEgressEvidence armedNodeProcesses=2, blockedExternalNodeRequests=0 and browserPageErrors=0, browserExternalRequestsBlocked=0.
- Full cross-platform source suites are recorded after final-head checks.

## Strict limitations

NOT an OS firewall or syscall-level audit: non-Node native executables, DNS-level requests, worker processes not inheriting the preload, custom native bindings, unsupported network stacks, child environment overrides and opted-in agents are not proven isolated. This protects and observes only recognized APIs and the explicitly disposable source-server scenario. User-authorized integrations in normal product runtime are NOT modified.

B0-05 exhaustive egress inventory and host network namespace sandbox qualification remain open. Official complete server TS/build, actual independently model-written signed governed Case report, installed Windows application E2E and comprehensive independent security review remain release NO-GO.
