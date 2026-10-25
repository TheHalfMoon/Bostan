# B6-17 — Prevent OAuth and SPA URL referrer leakage in static HTML

Private Bostan source-only work. Do not merge main, publish, deploy, enable GitHub Actions, buy any service or touch real user authentication state.

## Problem and solution

Bostan production static SPA HTML previously lacked explicit Referrer-Policy, including on the OAuth handoff route and private company URLs. Depending on browser behavior and external navigation, the source URL may otherwise leak as a Referer.

The helper setBostanStaticHtmlPrivacyHeaders is now used on both actual Express static HTML paths: literal / and /index.html, and the SPA fallback that serves /oauth-handoff and company HTML routes.

Each sets:
- Referrer-Policy: no-referrer, preventing source URL propagation to other origins.
- X-Content-Type-Options: nosniff, preventing MIME sniffing of the HTML response.

Cache-Control: no-cache on HTML is preserved. The hashed JS/CSS asset caching and /api contracts are not modified. OAuth callback validation, navigation and account state are not altered. No broad CSP or opener isolation was imposed without separate compatibility qualification.

## Real evidence — Mac, 2026-10-26

- 9 passing server Vitest tests across static index, static cache and Vite HTML renderer suites, including synthetic OAuth parameters that must not appear in HTML responses.
- General Bostan source Node suite: 147 PASS, 0 FAIL, 9 Windows-specific SKIP (156 total).
- Real private source Bostan + PostgreSQL clean stop/restart and Chromium: BOSTAN_LOCAL_PERSISTENCE_E2E_PASS exit 0, JS page errors 0, external HTTP requests 0, clean stop.
- Actual Playwright HTTP inspected /index.html, /oauth-handoff with synthetic code/state query, and a company Dashboard URL. All three returned 200 HTML, both required privacy headers, no-cache, and never reflected the synthetic query parameters.
- Explicit separate opt-in BOSTAN_LIVE_LOCAL_BROWSER_HTML_HEADERS_E2E=1 requires the existing real private Chromium QA opt-in. No real third-party OAuth sign-in was performed.
- No paid model, external inference, user documents, or authentic credentials were used.

## Limits and remaining release gates

This is targeted static HTML referrer/content-type protection, not a comprehensive XSS/clickjacking/security audit or an API authorization change. Vite development middleware and external hosting need separate security headers qualification before deployment. Full server TypeScript previously hit SIGKILL under high resource pressure on the 8-GiB Mac; no full typecheck pass is claimed.

Real B5 model first-agent Done/run-authored comment, independent verifier and canonical Case, installed Windows app/installer, full compiler, cross-platform QA and independent security signoff remain OPEN.

Repository PRIVATE, inherited Actions disabled, Draft/unmerged. Release NO-GO.
