# B5-18 — Two separate real free-model workers in one disposable company

**PRIVATE DRAFT. No merge into main, publishing, deployment, paid models, GitHub Actions or release.**

## Why this grain

B5-17 proved one real free-model worker's autonomous task/comment/done after an actual Bostan source-app/PostgreSQL restart. B5-18 adds a separately admitted, independently identified second real worker, a second scoped workspace, second task, and second heartbeat **in that exact same disposable company**, after the first worker's outcome was confirmed. This is sequential execution rather than separate synthetic companies.

## Changes

- The extended private source smoke accepts one further explicit opt-in: BOSTAN_E2E_TWO_AGENT_TEAM=1. It refuses this unless the independent BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E and BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL opt-ins are both present. The existing free-model allowlist remains mandatory.
- The original Bostan first-agent integration now optionally creates another real opencode_local engineer under the same company. The second worker uses a distinct workspace, agent, issue, and heartbeat; both workers must finish with succeeded and exit 0, separate persisted task Done, and distinct exact comment markers.
- The existing default single-worker or persistence-only paths remain unchanged.
- The test profile, PostgreSQL, app, model inputs, and tasks are synthetic, temporary, and bounded to 127.0.0.1.

## Test command

    BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 \
    BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E=1 \
    BOSTAN_E2E_TWO_AGENT_TEAM=1 \
    BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL=1 \
    BOSTAN_E2E_FREE_MODEL=opencode/deepseek-v4.1-flash-free \
    node scripts/bostan-local-live-persistence-e2e.mjs

## Qualification receipt

- Explicit admission Node tests: **18/18 PASS**, no skips.
- Actual two-worker runtime: **PASS, exit 0** on Mac, 2026-10-25. First real free-agent heartbeat **succeeded**/exit **0**/issue **done**/exact comment marker present. Second real free-agent heartbeat independently **succeeded**/exit **0**/other issue **done**/second exact comment marker present. Source harness additionally checks distinct agent/issue/run IDs, same company ID, and an actual clean PostgreSQL and app stop; temp QA profile removed. Both runs reported costUsd **0**; actual future provider availability or billing is not guaranteed.
- Default no-model local source app and PostgreSQL persistence smoke was rerun on this exact B5-18 branch: **PASS, exit 0**; its verified list remained unchanged (private-health, company-create, clean-stop, restart, persistence, clean-stop). The B5-17 one-worker actual model path is also exercised as the first part of B5-18.

## Strict boundaries

This is **NOT independent reviewer factual verification**. The second worker does not evaluate the first worker's actual externally verified work or produce the B5-16 strict signed-JWT source-cited verification report. It cannot establish the full founder -> CEO -> specialist -> independent verifier -> policy/effect readback product story. No live provider external side effects beyond explicitly approved free-model inference. Do not equate two synthetic tasks with a production autonomous company.

B4 document analytics/OCR, real consent/budget/provider-effect reconciliation, comprehensive server TypeScript, Windows/Chromium, B6 installer, full identity migration and security review remain OPEN. Free-model availability and future cost are unguaranteed. Release remains **NO-GO**.
