# B5-23 — Bind both ordinary model-worker acceptance receipts to exact heartbeat runs

**Private Bostan source development. No paid LLM, GitHub Actions, main merge, deployment or publishing.**

## Problem observed

The B5-17 and B5-18 ordinary free-worker source acceptance path previously accepted any issue comment containing BOSTAN_CLEAN_RUN_PASS or BOSTAN_SECOND_AGENT_PASS after a heartbeat ended successfully. The stronger B5-20 cross-worker review mode already required authenticated worker/run citation, but ordinary single-worker and two-worker (non-review) acceptance did not. A stale agent comment or a board-attributed comment with a copied marker could therefore be misread as fresh model execution proof.

## Change

- Introduce one run-bound receipt predicate for saved comments: expected persisted UUID, actual authorAgentId, exact createdByRunId equal to the completed heartbeat ID, and one explicitly allowlisted standalone success marker.
- Apply it to the first worker before logging acceptance, and to the second worker regardless of whether independent cross-issue review is enabled.
- Reuse the same predicate inside the B5-20 source-to-reviewer citation path. That path also verifies an independent reviewer comment attributed to its own run and the actual unpredictable persisted source comment UUID.
- Embedded impostor marker tokens, reused comments, wrong run, missing author, invalid IDs and unsupported markers all fail closed. The real separate B5 canonical Issue/Case completion policy and B4 source HMAC verification are NOT bypassed.
- No change to backend REST API, database schema, actual worker prompts, model/provider flags, payment or other runtime permissions.

## Tests and measured evidence

- **33/33** focused source QA tests PASS, including newly added false acceptance attacks.
- **21/21** actual isolated local PostgreSQL + signed Native Runner/JWT/REST canonical B5 verifier cases PASS (five suites). These qualify local platform semantics, not model truth.
- Default isolated Bostan/Pg source application stop/restart/persistence/clean stop **PASS**, exact output BOSTAN_LOCAL_PERSISTENCE_E2E_PASS, exit 0.
- Alibaba Open Code Review OCR CLI delegation mode ran locally with no model API request. Workspace review preview selected two modified scripts, and OCR supplied their resolved system review rules. Diff also inspected manually. Do not describe delegation as an LLM review.
- Additional broad Bostan Node regressions qualified by the corresponding command log before PR creation.

## Known qualification limits

The real remote free OpenCode provider returned Free usage limit reached in B5-22. No spend, account workaround, or paid credential switch was performed. No real free-model B5-23 two-agent run can be claimed from offline/synthetic evidence alone. B5-19 prior actual real source-citing review passed, but this new exact heartbeat receipt is not yet requalified with free remote inference. Full founder/CEO/specialist/native verifier model reasoning, real third-party effects, B4 data retrieval/OCR/analytics, Windows/Chromium, independent security and offline install packages are still open. **Release NO-GO.**
