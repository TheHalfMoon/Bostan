# B5-33 — Real free-agent source review: eliminate duplicate heartbeats

Private Bostan source QA, stacked on B6-22 / PR #142. No main merge, public release, deployment, inherited Actions, paid model, or real business data. Synthetic company, tasks, and comments only, with local PostgreSQL, explicit localhost admission and exact free-model allowlist.

## Root cause: observed, not inferred

A bounded first+second agent test using opencode/deepseek-v4.1-flash-free successfully completed the first real worker but failed to qualify the second. Independent read-only forensic SQL inspection of the stopped, disposable PostgreSQL17 QA database confirmed:
- Creating and assigning each synthetic issue scheduled an assignment heartbeat.
- The harness additionally invoked an on_demand heartbeat for each agent. There were four successful heartbeat runs for two agents.
- The second reviewer saved an authenticated, run-attributed comment with the required marker and a real source comment UUID, and marked its own issue Done, but that comment belonged to the assignment run while the harness expected the overlapping on_demand run.
- The first agent wrote multiple genuine marker comments. The reviewer cited one authentic comment from the first on_demand run, while the harness arbitrarily selected another valid comment from that same run.
- The previous rejection was thus a harness concurrency/receipt-selection failure, not authorization to ignore run provenance.

No real credentials, conversation logs, comment bodies or model outputs were exported in the forensic receipt.

## Fix

- Do not call heartbeat/invoke after the synthetic task has already been assigned. Poll the local, authenticated company heartbeat-run list for a uniquely identified assignment run for exactly the expected agent and issue. Reject ambiguous or malformed results, foreign-agent runs, and a non-private source runtime.
- Continue to require terminal success, exit code 0, persisted task status Done and at least one marker comment authored by the exact expected agent and run.
- Require the independent reviewer comment's real source UUID to refer to any genuinely persisted, matching-run first-agent marker comment. Never accept a foreign, older, board-authored or fabricated source comment.
- Preserve bounded waiting, 0-budget agents, strict model allowlist, opt-in, and private/temporary profile guards.
- Two extra Node regressions ensure manual on_demand runs cannot be mistaken for automatic assignment evidence and multi-comment citation selection remains provenance-safe.

## Executed verification — 2026-10-26

- Focused Node tests: 35 PASS, 0 FAIL.
- Broad Bostan Node source suite: 151 PASS, 0 FAIL, 9 Windows-specific SKIP (160 total).
- Real disposable macOS source app and PostgreSQL restart/persistence test: PASS, exit 0.
- First free agent real authenticated heartbeat: succeeded, exit 0, task done, exact marker comment from the same run, provider-reported costUsd 0.
- Second distinct free-model agent real authenticated heartbeat: succeeded, exit 0, task done, own exact marker comment and actual UUID citation of the first run-owned persisted source comment, provider-reported costUsd 0.
- Script reports BOSTAN_LOCAL_PERSISTENCE_E2E_PASS and confirms private health, restart, persistence and clean stop. Full free model: opencode/deepseek-v4.1-flash-free.
- The run left no active app/PG in the synthetic profile. Earlier failed synthetic profiles remain separate for internal diagnostics.
- No paid model fallback, user data or external business side effects.

This is not the independently governed, signed canonical Case review. The separate Case acceptance, official complete server compiler/build, installed Windows package and independent security qualification remain unverified. Release NO-GO.
