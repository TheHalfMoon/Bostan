# B6-12 — Real private browser Codex adapter selection remains paused

**Bostan private source development only. No main merge, publishing, deploying, GitHub Actions, paid inference or paid cloud.**

## Actual new first-run behavior qualified

B6-09 established private real React + PostgreSQL + Chromium and clean shutdown; B6-10 added first-company creation by browser interaction; B6-11 added saving the first agent as an **inactive setup draft**. B6-12 proves the next user-facing transition through actual Chromium selection of the OpenAI tile on the Connect a model step, with the agent remaining paused throughout.

An independent fifth explicit flag is required on the disposable Bostan source harness:
BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 BOSTAN_LIVE_LOCAL_BROWSER_E2E=1 BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E=1 BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E=1 BOSTAN_LIVE_LOCAL_BROWSER_ADAPTER_SELECTION_E2E=1 node scripts/bostan-local-live-persistence-e2e.mjs

This source test creates only synthetic company/agent records inside an isolated private temporary Bostan/PostgreSQL HOME, then opens real Chromium with external HTTP routing denied. It clicks OpenAI from the actual onboarding radio choices and waits for the Connect a model step. It never submits credentials, invokes an adapter, checks provider quotas, runs an LLM, starts a heartbeat or signs in.

## Actual internal runner identity learned from PostgreSQL

Initial test runs correctly detected a mismatch: the UI tile was OpenAI, but stored agent adapterType was paperclip_runner, not codex_local. A **read-only real API inspection** of the stopped disposable source app's synthetic record established:

- adapterType: paperclip_runner
- adapterConfig.provider: codex
- adapterConfig keys: provider, model (no credential fields)
- status: paused
- pauseReason: setup
- metadata.setupAdapterPending: false

This is Bostan's native runner compatibility contract, NOT the wrong provider. The guard named isPersistedPausedCodexSetup intentionally accepts either legacy direct codex_local or native paperclip_runner with **provider exactly codex**, only when the actual persisted agent is paused, in setup, with setupAdapterPending false and no enabled heartbeat. It explicitly **rejects** an unrelated runner/provider such as claude or copilot, active agent status, wrong pause reason, stale pending flag and enabled heartbeat. No internal protocol ID or required attribution was cosmetically renamed.

## Verification, Mac 2026-10-25

The final source-based Mac Chromium + PostgreSQL run returned:
BOSTAN_LOCAL_PERSISTENCE_E2E_PASS, exit 0, with:
private-health,company-create,clean-stop,restart,persistence,real-headless-chromium-private-ui,real-browser-new-company-onboarding,real-browser-first-agent-inactive-draft,real-browser-adapter-selected-still-paused,clean-stop.

Browser JavaScript errors: **0**. External HTTP requests attempted and blocked: **0**.

Node source QA: **123 PASS, 0 FAIL, 9 Windows-only SKIP** (132 test cases). This includes 14 focused source-browser/admission tests with positive and negative controls for native Codex provider compatibility. Alibaba OCR local delegate preview selected all **3/3** changed files for static-rule selection; this is not a model-based independent review.

## Still not verified

B6-12 does not run a real model, test provider login, qualify free-model OpenRouter rate-limit resilience, exercise full end-user task execution or independently attest a B5 native Case. The complete Windows installer/browser, B4 OCR/document/analytics, integrated B5 independent two-agent review and security audit remain open. GitHub repository stays PRIVATE with Actions disabled, no publication and no main merge. **Release NO-GO.**
