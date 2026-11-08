# B5-28 — Expose the actual failed OpenCode hello-probe stage safely

Private Bostan source development only. No main merge, deployment, publication, Actions, paid model or fallback.

## Measured issue

On 2026-10-25 two actual zero-priced OpenRouter QA models (Cohere North Mini Code :free and Recursive Flint :free) failed during the first agent's Bostan lifecycle verification, before any second reviewer could start. The persisted agent displayed only harness_test_failed.

A separate explicitly admitted, zero-price real OpenCode test through the authorized localhost Bostan test-environment endpoint returned these SAFE structured check codes:

- opencode_cwd_valid: info
- opencode_headless_permissions_enabled: info
- opencode_command_resolvable: info
- opencode_models_discovered: info
- opencode_model_configured: info
- opencode_hello_probe_failed: error

Thus command availability, workspace setup and model configuration checks passed but an actual hello invocation failed. The exact reason for that failed invocation is not confirmed by the safe receipt. Do not assert rate limiting or a first-agent success on the basis of this evidence. Raw test output and the operator's credential were not shown or committed.

The diagnostic source runner used a disposable Bostan HOME. During its diagnostic shutdown, the source server did not complete a graceful exit within the bounded wait, and a dedicated temporary PostgreSQL process remained running. The specific disposable PostgreSQL process and its exact temporary data directory were verified, then stopped with pg_ctl -m fast; an accidentally long-lived source scan was also terminated. The user's pre-existing separate PostgreSQL server and unrelated applications were untouched. Keep the temporary QA profile for a subsequent controlled diagnostic.

## Code fix

Bostan's harness verifier now maps an explicit *_hello_probe_failed check from a failed environment test to a fixed harness_probe_failed lifecycle error before falling back to the generic harness_test_failed. The agent lifecycle presents a fixed actionable message: the execution tool launched, but its hello verification failed; inspect agent Configuration test check codes; no task was executed.

The opt-in private source QA's lifecycle report recognizes this fixed, precise category without printing the original source error or provider data. The existing free-provider rate/quota classifications take precedence when backed by explicit signals; unrelated failures still fail closed. No authentication, test-pass condition, source attribution, task status or cost control was weakened.

## Actual tests, 2026-10-25 Mac

- Server harness verifier and lifecycle diagnostics: 53/53 PASS.
- Source first-agent guard tests: 19/19 PASS, including secret-leakage negative test.
- All Bostan Node source tests: 128 PASS, 0 FAIL, 9 Windows-only SKIP.
- Scope: tests of error classification; a genuine successful first model-driven task, run-authored comment, second reviewer and canonical Case approval remain UNQUALIFIED.

Draft PR only. Repository PRIVATE, Actions disabled, main unchanged. Release NO-GO.
