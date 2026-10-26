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
