# B5-19 — Real second agent retrieves persisted first-agent evidence

**Scope:** private opt-in Mac source QA, no release, main merge, publication, GitHub Actions, paid resources, or permanent user profile modifications.

## The gap

B5-18 qualified two separate free-model workers executing tasks in one synthetic company, but the second never actually read or checked the first worker's output. B5-16 already verifies canonical source-cited review semantics deterministically using genuine signed-JWT HTTP and SQL, but its reviewer judgment was a scripted fixture, not real model output.

B5-19 introduces a narrower, first real read-after-write review handoff without claiming the whole B5-16 canonical approval cycle.

## Implementation

The existing disposable local source runtime now accepts an *additional optional* BOSTAN_E2E_REVIEW_FIRST_AGENT=1 gate, admitted only after the explicit original local-source, free online-model and second distinct-agent opt-ins. Unqualified, paid, or unknown model IDs remain rejected.

The first real OpenCode worker must complete a synthetic task and persist an actual Bostan issue comment with the original QA marker. The second worker, in a separate workspace under the same throwaway company, receives **only** the first issue UUID, not the real comment UUID. It must call actual Bostan issue/comment reading tools, identify the saved comment and post the returned source comment ID on its own review task before marking that task done. The harness checks the source comment against actual first-issue comment rows and requires a matching second-task comment containing the marker and exact first source-comment ID. It additionally checks that the source comment was authored by the first agent's authenticated agent ID and that the citation was authored by the distinct second agent's authenticated agent ID; ordinary board or third-party comments cannot satisfy this test.

A real HTTP read is not proven merely because a model says "I read it"; the unpredictable persisted source-comment ID binds the claimed review to the actual previously saved resource. It does not prove quality of factual assessment or any third-party side-effect reconciliation. No signed JWT or canonical independent-verifier Case handoff is claimed for this legacy OpenCode review task.

## Verification

- 24/24 explicit Node tests for prompt boundaries, persisted source citation validation, forged ID and wrong-author rejection, strict opt-in, model allowlist, localhost and disposable runtime guardrails — PASS.
- First actual Mac free-model review run: **PASS, exit 0**, independently identified agents, two successful runs and matching actual source comment UUID citations.
- Second real Mac run with strict author provenance added: **PASS, exit 0**. Both free-model worker heartbeats succeeded, exit 0, both task statuses done, exact first worker comment and second review comment persisted. The verifier's previously unseen source-comment UUID matched the first agent-authored row; the model's review comment was authored by the distinct second agent. Local Bostan and PostgreSQL stopped cleanly, and the disposable test profile was removed.
- Recorded costUsd 0 for both runs. This is provider-reported accounting only, not proof of future provider pricing or guarantees.
- Regression check on this exact branch with no model option: default private app/real PostgreSQL company persistence, restart and clean stop **PASS, exit 0**. All previously established B5-18 two-worker behavior remains separately gated.
- Both source-only scripts pass Node syntax checks and git diff --check is clean.
- The tests confirm authenticated author-agent IDs for both source and reviewer comments; they do **not** claim a cryptographic independently signed review document.

## Still open

CEO/founder assignment, actual B5-16 governed Case source-HMAC JSON verification by real model, cross-agent tool scopes, budget/consent, external effect readback, broad B4 analytics/OCR, full server TypeScript, Windows/Chromium installed E2E, release packaging, and independent security qualification. Online model provider access is free-labeled but not guaranteed to remain free.

**Release remains NO-GO.**
