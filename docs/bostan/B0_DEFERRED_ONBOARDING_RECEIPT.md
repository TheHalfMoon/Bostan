# B0-08a — First-run without an AI provider

**Status: functional localhost milestone, not a complete agent or distribution qualification.**

## Lineage

Parent B0-07 Draft PR #33, commit `9c5aec9c6921f549ae7a0cfde12adf3a330f3be6`.
Work branch `work/b0-onboarding-offline`.

## Implementation

- The first-run model screen now offers **Set up AI later**. This is separate from the existing **Connect** path, which retains all model, login, provider and environment qualification gates.
- The button remains disabled until the server-side draft agent has a persistent ID and successful setup preparation.
- Choosing it waits for outstanding setup-save work, reads agents from the backend and verifies that the chosen record is exactly the current company's agent with lifecycle `paused` and pause reason `setup`.
- Any missing, foreign, incomplete or already-hired setup is refused without leaving onboarding. It never hires, generates credentials, creates a task, issues agent heartbeats, or bypasses provider checks.
- After successful confirmation, selects the created company, closes onboarding, and routes to the company agents page. No agent execution is implied.
- New isolated unit tests assert all fail-closed branches and the exact server-side paused marker. Browser acceptance explicitly requires `BOSTAN_E2E_CONFIRM_TEMP_DATA=1` plus a localhost URL, and creates disposable data.

## Verified October 24, 2026

- `pnpm install --frozen-lockfile --ignore-scripts`: successful; inherited generated-bin warnings.
- `pnpm --filter @paperclipai/plugin-sdk ensure-build-deps`: successful.
- `pnpm exec vitest run ui/src/lib/onboarding-defer.test.ts ui/src/components/OnboardingWizard.test.tsx`: **179/179 passing**.
- `pnpm --filter @paperclipai/ui typecheck`: **PASS**.
- `pnpm --filter @paperclipai/ui build`: **PASS**; inherited nonfatal chunk-size warning.
- Real localhost Bostan source runtime, isolated temporary HOME and PostgreSQL. Chromium/Playwright E2E: company created, agent name entered, moved to model screen, clicked **Set up AI later**, navigated to `/agents`; queried server-side agent list and verified `pauseReason=setup`, `lifecycleState=paused` and company identity. **PASS**, no model credentials.
- Local runtime stopped cleanly with no stale runtime lock. No real user data/home directories were modified.
- Test script: `scripts/bostan-onboarding-defer-browser-check.mjs`. Reproduction requires a **fresh disposable localhost instance** and browser installation.

## Important release gaps

The deferred agent is **not a functional AI worker** until explicitly connected, environment-tested and hired. Provider-auth workflows and real task execution remain pending. A bundled desktop installer and a full cross-platform and egress security qualification are also pending. Other imported UI/runtime identifiers remain. Release: NO-GO; no main merge, public hosting or npm publish.
