# B6-28 — MCP connection/probe/catalog error and health-detail privacy

Private Bostan development, 26 October 2026, stacked on B6-27 PR #154. No merge to main, release, deployment, public repo, inherited Actions or paid providers. Legally required source attributions stay unchanged.

## Verified exposure pathway

The original B6-27 patch protected gateway token and pasted OAuth configuration errors, but left several first-party MCP connection surfaces forwarding untrusted diagnostic text directly to customer-visible UIs. Specifically:
- CatalogDialog rendered raw catalog.error from a remote MCP tool catalog.
- AddConnectionDialog emitted raw create/probe/activate exception messages in toasts and the inline probe error.
- Worse, even a *successful* MCP health check could return a connection with arbitrary healthMessage or lastError; these were inserted directly into the probe result and could echo an upstream Authorization bearer token, signed URL, provider payload or private code.

## Change

Reuse the existing B6-27 fixed-copy safeCredentialUiError(untrusted, action) helper for additional connectionCatalog, connectionCreate, connectionProbe, connectionActivate and connectionHealth actions. Every copy value is a short static Bostan explanation. It never uses the exception text, provider-provided health details, or fragile regex substitutions; source response objects, transport details and API interaction remain unchanged. The health status badge, tool count, quarantined count, measured round-trip latency, credentials as vault references, ability to retry and original mutations all remain available. This consciously suppresses detailed provider error diagnostics from credential-bearing operator views.

## Actual coverage

- Component-level React/jsdom test mounts the real CatalogDialog and AddConnectionDialog (with a simple dialog portal mock), rejects a tool catalog request with a synthetic bearer token, rejects connection creation with a token, and successfully runs the health-check -> catalog-refresh flow with injected healthMessage/lastError containing credential markers. It asserts that screen/toast text contains only safe Bostan copy.
- Reused fixed-copy helper unit probes cover all old plus five new action variants, including OAuth code, state, signed URL and bearer injection.
- Four focused UI files: **33 PASS, 0 FAIL**.
- Official UI TypeScript tsc -b and Vite build: PASS; the previously existing large-bundle advisory remains.
- Native Mac Bostan Node source suite: **165 PASS, 0 FAIL, 9 platform SKIP** (174 total).
- Five original native Case/JWT/HTTP/real PostgreSQL integration suites: **22 PASS, 0 FAIL**.
- The first local source browser run was blocked by a missing Playwright-pinned chromium-headless-shell v1234 binary. It was restored via the free official Playwright headless-only browser installer (not a paid cloud service), without touching unrelated user apps. The retry on the same amended B6-28 code **PASS**: real private source app/PostgreSQL clean stop/restart/persistence/Chromium smoke, page errors 0, external blocked requests 0.
- Native Windows source regression is recorded separately upon verification on the amended B6-28 code.

This is a scoped UI privacy fix, NOT evidence of a comprehensive security sign-off, model-authored governed Case, official full-server build or installed Windows application. Release remains NO-GO.
