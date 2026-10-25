# B6-10 — Real private browser first-company onboarding on Mac

**Private source-only development. No merge, public release, paid model, deployment, or enabled GitHub Actions.**

## Purpose and safety

B6-09 established that a real private Bostan React UI could hydrate in Chromium and read persisted PostgreSQL state. B6-10 extends this to a **user interaction journey**: the deterministic no-LLM onboarding wizard, including creating a second synthetic company by clicking its actual UI and verifying the agent-setup transition.

The parent B6-09 disposable-source smoke still requires BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 and BOSTAN_LIVE_LOCAL_BROWSER_E2E=1. B6-10 adds a **third, independent opt-in**:

BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 BOSTAN_LIVE_LOCAL_BROWSER_E2E=1 BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E=1 node scripts/bostan-local-live-persistence-e2e.mjs

With the three flags, the browser fixture:

1. Uses a fresh synthetic organization name generated with a UUID and the existing ephemeral, private Bostan app/PG instance (never the installed user profile).
2. Enables the required experimental onboarding surface on this **throwaway instance only**.
3. Opens the real /onboarding route, follows the normal Start Onboarding / Build a new organization entrypoint if present, waits for the actual organization-name question, types the synthetic company name and clicks Continue.
4. Waits for the real first-agent name input (the next wizard step). It never invokes an LLM/provider, creates a credential, connects an external app, or chooses an agent model.
5. Reads Bostan's actual company list and goals through the **browser's own same-origin API client**, verifying that this particular UI-created company exists and that no unrequested company goal was invented.
6. Closes Chromium/PG cleanly and removes the disposable profile on success, preserving none of the synthetic company content. The existing B6-09 network restriction blocks outbound HTTP beyond the exact localhost instance; service workers and downloads are disabled.
7. Retains the deployed localStorage internal compatibility key paperclip-onboarding-state, rather than breaking persisted onboarding state in the name of cosmetic rebranding. Required donor attribution is not altered.

## Actual Mac evidence — 2026-10-25

The real local source app, free Chromium Headless Shell and isolated PostgreSQL ran the full B6-09 + B6-10 journey. The actual result was:

BOSTAN_LOCAL_PERSISTENCE_E2E_PASS, exit 0, verified private-health,company-create,clean-stop,restart,persistence,real-headless-chromium-private-ui,real-browser-new-company-onboarding,clean-stop.

The browser reported **0 JavaScript page errors** and **0 attempted external HTTP requests blocked**. Actual UI input, button clicks, database records and post-click wizard transition were observed, not simulated by a direct company-creation API call.

Additional qualification:
- General Bostan Node source tests **120 PASS, 9 Windows-only SKIP, 0 FAIL** (129 cases).
- The B6-10 private wizard admission tests and preceding network guards **11/11 PASS**.
- Alibaba OCR local delegation preview selected **3/3 updated files**, static rules only, not independent LLM security review.
- Git whitespace validation **PASS**.

## Remaining hard release gates

This is a genuine source application onboarding browser E2E on Mac, but the later live-LLM team-lead chat, independent two-agent B5 current-source verifier and real Case approval have not qualified. A complete installer, Windows end-user/browser journey, independent comprehensive security review, B4 real document/OCR/analytics and external connector journeys are also open. No launch, deployment or main merge was performed. **Release NO-GO.**
