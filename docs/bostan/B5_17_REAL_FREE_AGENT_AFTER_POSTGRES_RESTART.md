# B5-17 — Free model execution after real Bostan PostgreSQL restart

**Private, opt-in, source-only qualification, 2026-10-25. NO MERGE to main, no distribution, paid service, or GitHub Actions.**

## Improvement

Previously, Bostan's existing real free-agent QA and its real disposable-source-app/database restart smoke were exercised separately. B5-17 reuses both original harnesses with a new *explicitly optional* second step in the existing source-runtime smoke. The default persistence-only behavior is unchanged.

After starting an isolated local Bostan source process, writing a synthetic company to actual PostgreSQL, stopping it, restarting and checking that exact company survives, the smoke can now invoke the original Bostan free-agent E2E against the still-running restarted instance. It checks actual agent lifecycle, task assignment and wake, a real free-labeled online model response through Bostan, a persisted task comment containing its exact QA marker, actual task Done, a successful heartbeat exit and finally graceful Bostan/PostgreSQL stop. No external effect beyond the approved free-model request was exercised.

## Explicit admission

To run the opt-in expanded QA only, both original admission and additional free-model admission flags are mandatory:

    BOSTAN_LIVE_LOCAL_QA_CONFIRM=1
    BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E=1
    BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL=1
    BOSTAN_E2E_FREE_MODEL=opencode/deepseek-v4.1-flash-free
    node scripts/bostan-local-live-persistence-e2e.mjs

The agent test uses the original strict free-model allowlist, the exact isolated temp HOME, loopback URL and known source runtime ownership lock. Unknown/paid models and missing opt-ins fail before filesystem or network work. macOS/Linux source mode only; Windows has a separate constrained QA workflow. A real-user HOME and public endpoint are not supported.

## Mac test receipts

- Direct isolated free-model preflight: **PASS**; the free model returned the exact expected response. No personal keys or project data.
- Integrated source runtime: **PASS, exit 0**. Private loopback health; real PostgreSQL synthetic company create, clean stop, restart, exact persistence; authentic Bostan API first-agent lifecycle and heartbeat.
- Real free-model heartbeat: **succeeded**, exit **0**, no error, synthetic issue status **done** and exact expected task comment present. The run ledger reported **costUsd=0**. This is a reported QA value, not a guarantee about future cost, quotas or provider retention.
- Clean Bostan process/database stop verified by source harness, and private disposable profile automatically removed.
- Focused admission tests: **17/17 PASS**, zero skips/failures.
- Default path (without online-model or extended QA flags) re-run independently: **PASS, exit 0**. Verified unchanged private health, company create, clean stop, restart, persistence and second clean stop.
- This remains a single synthetic worker, not a CEO/specialist/independent reviewer acceptance case.

## Remaining release gates

The full founder -> CEO -> specialist -> separate model-run verifier -> source/effect readback -> evidence-linked completion journey remains OPEN. Further tasks include B4 OCR/retrieval/analytics, B5 real provider effect consent, budget fences and retries, complete server TypeScript, Windows/Chromium installed E2E, B6 packaging, all-brand cleanup and independent security QA. The free online model may be withdrawn; local offline inference is not proven. Do not treat legacy provider tool approval as safe for untrusted user workloads.

**Release: NO-GO.**
