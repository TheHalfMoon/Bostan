# B6-09 — Real private Bostan browser and PostgreSQL persistence smoke

**Private source-only development; no public release, main merge, deployment, paid model, or GitHub Actions.**

## Added real browser execution, opt-in only

The original local-source smoke verified only HTTP health, creating a synthetic company and reading it back after PostgreSQL restart. This wave adds a separate, opt-in, full Chromium/Playwright exercise of the **running, private** Bostan React application after its real local database is restarted.

To run on Mac or Linux with installed Playwright Chromium:
BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 BOSTAN_LIVE_LOCAL_BROWSER_E2E=1 node scripts/bostan-local-live-persistence-e2e.mjs

The command starts a fresh, mode-0700 disposable synthetic Bostan HOME, fresh PostgreSQL and loopback-only HTTP server; it does not touch the user's installed app, connected models or outside projects. The app is stopped, restarted, and stopped again with no lock/postmaster residue. On clean success, the temporary profile is removed by the existing source-smoke lifecycle.

The browser test in scripts/bostan-local-browser-qa.mjs:

- Requires exact http://127.0.0.1:<valid-port>/, explicit local app/browser opt-in and an actual newly persisted synthetic company UUID.
- Opens Playwright's free Chromium Headless Shell in a fresh ephemeral browser context, blocking service workers and downloads. **All HTTP requests outside this exact loopback origin are aborted**; the allowlist is regression-tested against alternate ports, localhost aliases, other hostnames, HTTPS URLs, external fonts, file and WebSocket URL forms.
- Loads the real built Bostan frontend, waits for React hydration and user-visible body content, checks that the page title contains Bostan, and handles a real observed temporary empty-root navigation transition without silently dropping the hydration requirement.
- Reads /api/health and /api/companies **from inside the real browser**, verifying private/local_trusted exposure and the same synthetic company identifier created before the PostgreSQL restart.
- Records only safe counters (JavaScript page errors and blocked external HTTP requests) and pass/fail booleans; never prints company names/IDs, credentials, screenshot content, browser profiles or raw browser logs. Chromium/browser contexts are closed even on failure.
- Does not invoke a model, use cloud credits, call third-party APIs, or claim installed Windows/browser functionality.

## Actual Mac evidence — 2026-10-25

Playwright v1.62.1 Chromium and Headless Shell were installed from their free official distribution into the Mac's test cache. They are not an installed Bostan app or the user's everyday browser.

On the final source branch:

- Real BOSTAN_LOCAL_PERSISTENCE_E2E_PASS, exit 0, reporting private-health,company-create,clean-stop,restart,persistence,real-headless-chromium-private-ui,clean-stop.
- Browser pageErrorsSeen = 0 and blockedExternalRequests = 0.
- Private browser source admission/network regression: **10/10 PASS**.
- General Bostan Node source regression: **119 PASS, 0 FAIL, 9 Windows-only SKIP** (128 cases total).
- Alibaba OCR local delegate preview: **3/3 changed source files selected**, static rules only; it is not independent LLM code review.
- Git diff whitespace validation: **PASS**.

## Qualification limits

The React browser test proves source app startup, hydration, Bostan title, private API data access and actual PostgreSQL persistence via a real browser. It does **not** prove every end-user clicking flow, complete installation, real human login, a full production security audit, Windows installed UI, or correct autonomous model decisions. Source browser behavior was tested **on Mac only**. B4 document/OCR/analytics breadth, B5 independent native two-agent current-source review, installer/browser coverage, third-party connector E2E and security remain release gates.

The existing Windows private DACL/source guard tests from B6-08 remain recorded separately. Bostan repository Private, inherited Actions disabled and this work Draft/unmerged. **Release NO-GO.**
