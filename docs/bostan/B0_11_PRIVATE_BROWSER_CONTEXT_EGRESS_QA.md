# B0-11 — Private browser context-wide HTTP, popup and WebSocket egress QA

Private source-only Bostan development, 26 October 2026. Stacked Draft on B0-10 PR #159. Do not merge main, release, publish, deploy, enable inherited GitHub Actions, spend model credits, or touch user applications and accounts.

## Actual scope and original gap

The B0-05 issue #30 calls for a full network egress inventory and deny-by-default qualification. Before this patch, the private source-browser smoke installed a page-specific Playwright HTTP route. A popup/new tab is a separate page not covered by that route, and native browser WebSockets are not reliably filtered by ordinary HTTP request interception. Worse, blocked external HTTP requests were counted but DID NOT fail QA: a private app could try an external endpoint, Playwright could abort it, and the test could still print qualified:true.

This is a QA evidence gap, NOT evidence that the production server has an external-data leak.

## Fix in disposable Chromium harness only

- Build a real isolated browser context with service workers blocked and downloads disabled.
- Before opening ANY test page, register one context-wide HTTP route so new pages and popups receive the same strict single-loopback-origin allowlist.
- Register Playwright context.routeWebSocket independently; only ws:// matching the exact HTTP loopback target host and port can connect to a local WebSocket service. External WSS, remote WS, local wrong port, userinfo, credentials and misleading hostnames are intercepted and closed with policy code 1008.
- Record blocked HTTP, blocked WebSocket and page errors. FAIL the qualification if any external attempt was blocked, not only if a request reached the destination. On a clean test, report blockedExternalRequests including both protocol families and blockedExternalWebSockets.
- No product runtime, telemetry resolver, production network layer or external-provider permissions were changed. This is test instrumentation and provides no blanket firewall outside the Playwright context.

## Actual evidence

- Browser source functional tests 10 PASS, 0 FAIL.
- Real optional Chromium negative probe with explicit BOSTAN_REAL_BROWSER_EGRESS_NEGATIVE_PROBE=1: 11 PASS, 0 FAIL, 0 SKIP. It launched Chromium and attempted synthetic HTTP, popup navigation, and WebSocket requests to synthetic.invalid. All three were intercepted; test asserted 2 blocked HTTP and 1 blocked WebSocket, and asserted that the same attempted-egress evidence FAILS the positive QA qualification.
- Real unchanged private Bostan HTTP/PostgreSQL persisted company, clean stop/restart, and headless Chromium app UI smoke after the patch: PASS, browser page errors 0, blocked external HTTP/WS combined count 0.
- Mac Node source on the updated guard before optional negative fixture: 175 PASS, 0 FAIL, 9 platform SKIP (184 total). Exact final fixture adds one opt-in-only test; cross-platform counts may differ.
- Native Windows source test, original canonical Case/JWT/real PostgreSQL regression and other release gates are recorded separately as qualified.

## What this does NOT prove

The backend Node service, plugins, remote agents, MCP, native model runtimes, CLI update hooks, third-party OAuth flows and user-authorized connections remain network-capable unless independently qualified. Playwright cannot prove whole-host outbound isolation, while the synthetic browser's external probes are deliberately blocked and do not contact a real host. Complete egress inventory, server/agent deny-by-default sandbox and independently reviewed report are still open under B0-05. Entire-server official compiler/build, Windows installed-app E2E and real model-led original governed Case closure remain NO-GO. No deployment.
