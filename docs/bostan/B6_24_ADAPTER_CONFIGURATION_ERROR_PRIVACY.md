# B6-24 — Adapter configuration and OAuth exception privacy

Private development branch, stacked on B6-23 / PR #144. No main merge, publication, deployment, GitHub Actions, paid provider or real account credential use. Legally required upstream license/provenance retained.

## Risk

AgentConfigForm still showed untrusted exception.message from runner upgrade, model discovery/refresh, environment-test mutation and lifted feedback, and both adapter-login and Claude browser-code/session/cancel flows. Provider exceptions may include OAuth code/state, token fragments, signed endpoint URLs, test environment variables or other credentials. Child cards and parent feedback are not safe places to print a provider exception.

## Fix

- Introduce a Bostan static-copy formatter in ui/src/lib/adapter-error-privacy.ts with seven explicit categories. Never pass through arbitrary exception strings or details.
- Use it for runner upgrade failure, environment test failure (both inline/lifted/compact card), model refresh/list query failure, adapter and Claude sign-in start/cancel/resume, and browser code submission.
- Preserve all existing boolean failure states, retry actions, login session mechanics, API requests, selection and lifecycle handling; only user-visible untrusted exception text changes.
- Add unit probes for credential-like exception messages across each category; update rendered failed-upgrade/test regression to inject synthetic sensitive text and assert it is not displayed. Not a claim to sanitize every server-provided structured success/failure payload across other components.

## Real verification on macOS 2026-10-26

- Focused React + helper suites: 135 PASS, 0 FAIL across two suites.
- Real UI TypeScript project tsc -b: PASS.
- Production Vite UI build: PASS; existing >500-KiB bundle advisory.
- No live OAuth providers, model charges or real credentials.

## Existing independently grounded gates

- Canonical source JWT/HTTP/SQL Case regression: 21/21 PASS on previous PR head.
- Real two free-model agent separate-workspace source-citing E2E: PASS from B5-33.
- Real private local Chromium/Postgres persistence: PASS from B6-23.
- Windows node source suite 154 PASS, 6 SKIP on native Windows from prior session.

## Unqualified gates

Full official server compiler/build on properly resourced host; production installed Windows app/browser/installer qualification; genuine independent model-driven signed Case report and actual external-effect consent/readback; comprehensive independent security audit and release acceptance. Release NO-GO.

## Latest-head source regressions and explicit compiler limits

- Broad Bostan Node source tests on the exact B6-24 Mac head: 151 PASS, 0 FAIL, 9 platform-specific SKIP (160 total).
- Real private Bostan macOS local source and PostgreSQL Chromium E2E: PASS, exit 0. Verified company create, clean stop/restart, persisted company, real headless Chromium UI, zero browser page errors, zero blocked outbound requests and clean stop. No network-based AI task or real customer data. The actual head was tested with the isolated app.
- A historical B5-31 disposable native TypeScript compiler 7.0.0-dev.20260707.2 was independently installed outside the repository and invoked on the exact 2,747-source server tsconfig on this head with bounded Go memory/CPU. **Timed out after 240 seconds, zero diagnostics produced, no success qualification.** Process was killed, scratch installation deleted, and repository dependencies/lockfiles unchanged. No claim of a successful entire server typecheck or build is made.
- Windows Abdulaziz capacity remains below the existing 6 GiB free RAM and 12 GiB TEMP/staging disk acceptance budgets, with no qualified installer available. Source tests alone do not waive native distribution qualification.

Result: B6-24 source UI and private Chromium gates PASS; server official qualification, independently governed model-driven Case and native Windows installer remain blocked. Release NO-GO.
