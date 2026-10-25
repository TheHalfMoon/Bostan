# B5-25 — Explicit issue/comment writes and persisted-state readback in source-only free-agent QA

Private development Draft PR. Never merge main, publish, deploy, enable GitHub Actions, or use paid models.

## Reproduced issue motivating this change

Previous B5-24 free Cohere OpenRouter testing reached real private Bostan/Postgres and produced one authenticated, run-attributed comment. Independent readback of the stopped synthetic profile showed the comment actually said BOSTON_CLEAN_RUN_PASS, NOT the exact required BOSTAN_CLEAN_RUN_PASS. The model also claimed the task had been marked done, but the real persisted task status was in_progress. Neither a miscopied marker nor a false done claim qualifies the task. Flint free also failed with adapter_failed/dispatching before completion.

## Scoped source-only QA change

- First- and second-worker prompts now say explicitly: use actual authenticated Bostan issue/comment tools, post exact BOSTAN token, mutate THIS synthetic task to done, GET task status and verify the persisted status is done before saying completion.
- Independent reviewer instructions preserve mandatory source comment readback, unpredictable actual saved source-comment UUID citation, independent run identity, and review issue persisted status.
- Status-first failure diagnostics now report only safe counters/booleans: exact-marker presence and count of authenticated run-attributed comments. They never echo model response text or credentials.
- Original exact marker, author/run attribution, B5 canonical Case, B4 source HMAC gates and third-party side-effect restrictions remain unchanged. This does not automatically set a task done.

## Qualification and limit

- 40/40 targeted Node tests PASS. Broad Bostan Node suite rerun and passed, with Windows-only skips on macOS.
- Alibaba OCR delegation mode selected the two source changes and static review rules, without any LLM API call. This is static assistive review, not a completed independent model review.
- New full live isolated Bostan/Postgres/OpenRouter free Cohere attempt on THIS branch FAILED: first heartbeat reported status failed, errorCode adapter_failed, executionStage dispatching, exit 1. No second-worker review, current-source independent verification or Case completion passed.
- Zero-price public catalog preflight and existing private credential gate remain enabled; there was no paid retry, model fallback, user data or public deployment.

## Open

Solve intermittent free provider dispatch failure; prove real worker tool writes/readback and independent second-agent source citation tied to exact runs; qualify the actual model-driven native B5 verifier and signed HMAC Case completion; complete B4 OCR/analytics, B6 packaging, Windows/Chromium and independent security. Release NO-GO.
