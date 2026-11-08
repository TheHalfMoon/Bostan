# B5-20 — Bind model-driven cross-agent evidence to exact heartbeat runs

**Development-only, private and opt-in. No main merge, publication, deployment, paid AI model, user data or Actions.**

## Reason

B5-19 proved two real free-model agent identities and a reviewer comment citing a saved original source comment from another task in the same disposable Bostan company. However, agent identity alone does not prove the saved comment belongs to the particular successful heartbeat under examination: an older comment by the same agent could be reused to claim fresh work.

The existing B5-16 canonical Case guard requires provenance tied to an actual reviewer run and current issue-document snapshot HMAC. B5-20 narrows this model-driven legacy integration gap; it does not redefine or bypass canonical Case rules.

## Implementation

The opt-in review helper requires two distinct authenticated agent IDs **and two distinct successful run IDs**. It locates the actual original saved comment only if its authorAgentId equals the first agent and createdByRunId equals the exact first heartbeat run. It locates the second saved review comment only if its authorAgentId equals the independent reviewer and createdByRunId equals the exact second heartbeat run, while referring to the unpredictable persisted source comment ID. Unknown, missing, swapped and reused run IDs are rejected; ordinary comments, model prose and user-attributed comments do not qualify.

The original source runtime and PostgreSQL restart harness, free-model allowlist, separate opt-in flags and all normal non-review paths remain unchanged.

## Qualification

- Node regressions including forged source, wrong author/run, missing run, bounded timeout and safe failure categorization: **27/27 PASS**.
- Real free-model two-worker review against a private disposable Bostan/PostgreSQL instance: **BLOCKED / FAIL** in two attempts on this branch before the FIRST model-driven task. The first attempt timed out after 90 seconds. The second, even with a bounded 180-second review-specific deadline, also timed out; the last private source API reading reported lifecycleState=verifying, status=paused, lifecycleError indicating an execution configuration/harness test failure. Hence **no model-written comment/run provenance was newly verified in B5-20**. These two tests must NOT be treated as passes. A direct isolated free-model OpenCode preflight DID pass, proving only that the model answered outside Bostan's agent lifecycle integration, not that adapter setup passed.
- Improvement based on the blocker: known lifecycle harness test failures are now detected promptly and returned as allowlisted, non-secret code harness_test_failed instead of silently waiting through an extended deadline. The ordinary Mac/Linux 90-second limit remains unchanged; explicit review-only mode permits 180 seconds. Windows retains 240 seconds.
- Default no-model private source persistence smoke: **PASS, exit 0**, checked on the final B5-20 source checkout; private health, company creation, clean stop, PostgreSQL restart, persistence and clean second stop.
- No real provider effect outside the previously approved free-labeled model. No user secrets or workspaces.

## Boundaries

Matching the first and second actual heartbeat run IDs shows run attribution, not the factual truth of the model's decision. The B5-19 authenticated agent identity/citation proof remains a prior verified capability; the stronger exact run provenance is source-tested but not yet live-qualified. The full native Case completion contract also requires a signed native reviewer tool call, structured B4 current source-HMAC document, and canonical governed Case handoff; those are **not yet integrated with real model inference** here. B4 analytics/OCR, Windows E2E/installer, B6 and independent security remain open.

**Release NO-GO.**
