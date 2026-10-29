# B1-55 — Real private free-agent task completion and independent source-cited review (current revalidation)

Date: 2026-10-29. STRICTLY PRIVATE, ZERO COST, NONPUBLISHING. Exact stacked parent B1-54 Draft PR #308 HEAD `93c1056eb09dfff0952c8bd3d42730790281f6b6`. No protected-main merge, deploy, release, npm publication or GitHub Actions enablement.

## Independent source identity and safe preflight

Existing native Mac OpenCode v2.2.0 was verified. The repo's existing strict allowed model `opencode/deepseek-v4.1-flash-free` appeared in an isolated standalone free-model catalog without inheriting credentials or the real OpenCode profile. A **real standalone model inference** using the existing `scripts/bostan-opencode-free-admission.mjs` passed at the same parent revision: a fixed synthetic exact-reply token was returned with **exit 0, ~4.17 seconds**; empty environment, temp disposable HOME under the admitted `/tmp`, no user account keys, provider credentials, or unrelated workspace files. A first attempt with a temp directory rooted outside the harness's canonical `os.tmpdir()` guard was refused safely, before provider inference; the corrected run used the explicit allowlisted directory.

## Actual first-agent task E2E — GREEN

On the **same committed parent source SHA** `93c1056eb09dfff0952c8bd3d42730790281f6b6`, executed the existing `scripts/bostan-local-live-persistence-e2e.mjs` with `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1`, `BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E=1`, `BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL=1`, exact allowlisted `BOSTAN_E2E_FREE_MODEL=opencode/deepseek-v4.1-flash-free`. The native Mac command ran under **`env -i`**, with only the fixed OS-loader/temporary HOME settings, tracking disabled and no inherited personal API keys. The source harness itself independently admitted an exact loopback-only Bostan instance, prepared fresh real local PostgreSQL, verified authenticated private health, created an entirely synthetic company, cleanly stopped/restarted Bostan+PG, checked persistence, then created and assigned an actual Bostan agent+task. The live free model used authenticated Bostan task tools to persist its exact task comment and mark issue Done.

**ACTUAL EXIT 0 in 127.74 seconds**. Redacted/private local output checks confirmed `first real free agent E2E PASS`, model heartbeat `succeeded`, run exit code `0`, issue persisted `done`, exact run-attributed marker comment present, end-to-end restart/persistence receipt true, provider-reported `costUsd:0`. This is **actual model + saved effect + readback**, not a synthetic mocked heartbeat. Log wrapper automatically removed only its own exact temp directory after success.

## Actual independent second reviewer — GREEN

Separately, again at parent source SHA `93c1056eb09dfff0952c8bd3d42730790281f6b6`, with the same safe synthetic-only strict allowlisted free-model admission and fresh owned real Bostan/PostgreSQL profile, **explicitly** enabled both existing opt-ins: `BOSTAN_E2E_TWO_AGENT_TEAM=1` and `BOSTAN_E2E_REVIEW_FIRST_AGENT=1`.

**ACTUAL EXIT 0 in 224.60 seconds**, redacted structured receipts:
- First agent: `succeeded`, exit `0`, source task `done`, exact run-attributed saved marker comment `true`, provider-reported costUSD `0`.
- **Distinct second agent**: `succeeded`, exit `0`, its own review issue `done`, exact review marker `true`, provider-reported costUSD `0`.
- **`persistedSourceCommentCited:true`**: the reviewer had only the source issue UUID, looked up the actual prior persisted comment ID through Bostan's authenticated issue APIs, then saved its **own run-attributed** citation of the first agent's actual saved source comment. The harness rejects invented, stale, foreign or wrong-run IDs and checks separate agent/run attribution. The temporary app/PG restart and persistence check passed before the worker phases.

Both full positive E2Es ran against the then-live committed parent revision. The zero-dollar values are **QA ledger-reported costs**, not an ongoing contractual price/quota guarantee or offline model capability. The free model uses a network provider, not on-device inference. No customer data or external business side effects.

Independent Mac post-run read-only scan: **zero** owned `bostan-live-persistence-*` runtimes and **zero** exact private log wrappers from either successful test. The outer source harness stopped/removed owned app and PostgreSQL and the wrapper cleaned its own isolated logs; Mac tracked checkout was clean before the B1-55 code changes. Unrelated PostgreSQL installations and user applications were not touched.

## Security hardening after live passes: no raw HTTP failure bodies

A review of `scripts/bostan-first-agent-free-e2e.mjs` uncovered a **test-only privacy bug**: any non-2xx Bostan API call previously embedded the arbitrary returned JSON body and raw endpoint, including dynamic UUID IDs, in the thrown exception text. Updated the existing helper to **never parse/print rejected HTTP response bodies**. The stable failure diagnostics contain only an allowlisted route category and bounded numeric HTTP status. Successful response JSON is still required, and malformed 2xx JSON produces a fixed bounded error without content. Invalid, overlong, token-injected, foreign or unknown endpoints map to `unknown` and never disclose the supplied data. Production API behavior and test task/agent orchestration are unchanged.

Tests on this later security-change commit:
- **Actual native macOS Node:** first-agent safety/receipt/route privacy regression suite **21/21 PASS**, no skips.
- **Native Windows Node 24:** same **21/21 PASS**, no skips, tracked B144 checkout clean, 0 PostgreSQL.
- **Native Ubuntu Linux WSL2 Node 22:** same **21/21 PASS**, no skips, no PostgreSQL started.

The live free-model runs were on the parent commit before this **failure-path-only** change, so do not claim they were rerun against the final changed error-diagnostic code.

## Remaining release NO-GO

This proves **repeatability of a small private synthetic real free-model task and its run-attributed second-agent source citation** at a current repository revision; the much larger governed founder→CEO→specialist→independent evaluator product workflow, model behavioral robustness and quota resilience, independent real untrusted task sandbox/effects consent, native Windows/Linux installed free agent journey, shared-DB write concurrency, installers, complete release/branding/provenance/security/privacy/NOTICE/license audits remain unqualified. A successful `costUsd:0` ledger value does not prove future zero-dollar pricing. Keep Bostan PRIVATE / DRAFT / NONPUBLISHING; no protected main merge, paid provider/model, customer data or release.
