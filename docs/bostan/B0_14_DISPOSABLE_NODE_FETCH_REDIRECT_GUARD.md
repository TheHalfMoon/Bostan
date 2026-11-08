# B0-14 — Prevent silent redirected Node fetch egress in isolated QA

Private Bostan development, 26 October 2026. Stacked Draft after B0-13 / PR #162. Do not merge main, publish, deploy, enable inherited GitHub Actions, run paid providers, or remove legally required source notices.

## Reproduced gap in B0-12 / B0-13

The isolated Node preload inspects the initial fetch URL and wraps Node's common HTTP/TCP/TLS calls. Node's native Undici fetch can follow an HTTP 302 redirect internally without consulting those wrapped public APIs again. Thus a source smoke could report zero blocked external network attempts even though a nominally permitted loopback fetch followed a redirect to a different destination.

A safe, genuine regression runs two loopback-only ephemeral HTTP servers inside a disposable Node subprocess. Source server 127.0.0.1 returns a 302 to the other localhost server on a different port. With B0-13, the redirected target received a request and the new test FAILED as intended ("Redirect reached forbidden sink"). No internet endpoint, customer server or real token was involved.

## Test-only correction

Under the same explicit BOSTAN_TEST_ONLY_NODE_EGRESS_GUARD=1 opt-in ONLY, the fetch wrapper now requests one hop with redirect: manual and detects 3xx responses with Location. It writes the fixed, payload-free audit category fetch-redirect and throws. Even if tested server code catches the error, the persisted audit causes the final private smoke to FAIL. A normal local fetch returning HTTP 200 remains available and was tested against the same source server.

No production Bostan runtime, actual browser fetch policy, OAuth integration, provider credentials, model access or user-allowed internet connections are changed.

## Qualification

- Before patch: actual ephemeral two-server Node subprocess test reproduced a redirect reaching the second server and intentionally failed.
- After patch: same real subprocess test PASSED, verifies the redirected server was never hit, and verifies a normal local 200 fetch still works. The audit contains fetch-redirect, never the redirected URL or secret.
- Focused existing+new Node subprocess classifier tests: 4 PASS, 0 FAIL.
- Full native Mac Bostan Node source: 181 PASS, 0 FAIL, 10 platform/opt-in SKIP (191 total).
- Actual disposable Bostan source HTTP and PostgreSQL persisted-company stop/restart plus Chromium private UI with both test-only Node/browser egress guards: PASS; 2 guarded Node startups, 0 forbidden Node API requests, 0 browser page errors and 0 browser external requests.
- Native Windows and canonical Case integration results recorded upon latest-head verification.

## Outstanding security limits

This test-only JavaScript preload is NOT a comprehensive firewall, whole-host network namespace or security audit. Native executables, direct syscalls, processes not inheriting this preload, runtime code outside known transport APIs, and user-authorized integrations are not generally covered. B0-05 full network audit and the official server build, real model-authored independent governed Case, installed Windows application and comprehensive external security review remain open. Release NO-GO.

## Completed exact-head cross-platform verification

- Native Windows Abdulaziz Bostan Node source suite: 183 PASS, 0 FAIL, 8 platform/opt-in SKIP (191 total); the actual local-to-local redirect regression passes there as well.
- Native Mac Node source: 181 PASS, 0 FAIL, 10 platform/opt-in SKIP (191 total).
- Five canonical Case/JWT/HTTP/native verifier/real PostgreSQL suites: 22 PASS, 0 FAIL.
- Actual disposable Bostan HTTP/PostgreSQL clean stop and restart with persisted company plus headless Chromium under BOTH browser and Node network probes: PASS; the Node guard armed twice, with no recorded external Node API attempts, browser errors or browser external requests.
- No Windows installer, paid provider, full-server compiler or native model-driven independent report was qualified in these tests.
