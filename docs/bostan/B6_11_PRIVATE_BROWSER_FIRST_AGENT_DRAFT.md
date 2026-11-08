# B6-11 — Real first-agent draft creation from the private Bostan onboarding UI

Private source-only development. No release, deployment, paid inference, main merge or GitHub Actions.

## Tested journey

B6-09 verified real private React UI, actual PostgreSQL persistence and clean restart. B6-10 verified actual browser company creation and transition to the onboarding wizard's Hire your team lead step. This B6-11 wave extends that **same real user-flow** to filling the first-agent name in Chromium, clicking Next, and proving the backend persisted exactly an **inactive setup draft** rather than running or hiring an agent before the user selected a model.

This step requires a **fourth distinct opt-in** on top of the private disposable source browser and wizard flags:

BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 BOSTAN_LIVE_LOCAL_BROWSER_E2E=1 BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E=1 BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E=1 node scripts/bostan-local-live-persistence-e2e.mjs

The new synthetic source QA code:

- Creates one random, disposable synthetic company through real Chromium UI using the B6-10 wizard.
- Checks that no unwanted company-level goal was invented.
- Fills the actual first agent field with a random synthetic name, clicks the real Next button, and observes the real POST to the new company's agents endpoint.
- Requires the returned agent's name to match, pauseReason to equal setup and metadata.setupAdapterPending to be true.
- Waits for the adapter-selection radio input in the actual browser, but **never selects a provider**, grants credentials, calls model inference, or starts any worker.
- Re-reads the same agent via its real, local Bostan API and verifies it remains the correct **inactive setup draft awaiting adapter selection**.
- Runs only within the private 127.0.0.1 origin and ephemeral source HOME/PostgreSQL. Chromium service workers, file downloads, HTTP off-box requests and user-facing screenshots remain disabled.

## Verified results — Mac, 2026-10-25

Final command returned **BOSTAN_LOCAL_PERSISTENCE_E2E_PASS, exit 0** and included:
private-health,company-create,clean-stop,restart,persistence,real-headless-chromium-private-ui,real-browser-new-company-onboarding,real-browser-first-agent-inactive-draft,clean-stop.

- **0** JavaScript page errors and **0** attempted external HTTP requests blocked.
- The B6-11 browser-admission focused tests and preceding safety checks: **12/12 PASS**.
- General Bostan Node source test suite: **121 PASS, 9 Windows-specific SKIP, 0 FAIL** (130 cases).
- Local Alibaba OCR delegation preview: **3/3 changed source files selected**, static review rules only. This is not an independent AI security review.
- Git diff whitespace validation: **PASS**.
- Mac-only genuine source-runner/browser execution, not a Bostan installer or a Windows GUI qualification.

## Hard release gates

No model/agent actually performs a task during this test. The app's B5 first-agent free-model tools, second independent reviewer tied to exact run/source evidence, signed native current-source Case completion, B4 document/OCR/analytics, complete installers/Windows/browser E2E, third-party connectors, and external security qualification remain OPEN. Repo private, inherited Actions disabled, draft-only and no merge/deploy. **Release NO-GO.**
