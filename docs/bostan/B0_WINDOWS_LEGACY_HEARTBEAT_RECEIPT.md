# B0-21 — Windows first-agent legacy heartbeat failure attribution

**Development-only private Draft. Release NO-GO.**

Parent: private PR #48, head `97f692161ea250c232222c10e6da0134fb100c3b`.

## Actual failure (Windows 2026-10-24)

In a disposable protected TEMP HOME with a genuine Bostan server and
PostgreSQL 17.11, OpenCode free-model pre-admission returned a verified
JSON text response. An agent was then created as `opencode_local`,
reached `lifecycleState=ready`, and a synthetic assigned issue entered
`in_progress`. **No completed agent task was proved.**

The first-agent E2E instead timed out after 175 seconds waiting for a
terminal heartbeat. Independent read-only PostgreSQL queries found two
`heartbeat_runs` with:

- status **`interrupted`**;
- stage **`preparing`**, without a recorded provider process;
- error code **`lease_released_before_terminal`**;
- start-to-terminal elapsed time about **one second** each.

A record indicating `task.run.measured` and lease-release fallback was
available, but the true pre-dispatch setup failure and checkpoint were
not. A later OpenCode server process did not qualify a Bostan agent run.

## Changes and safety

1. The first-agent E2E now treats `interrupted` as a **terminal failed QA
   outcome**. It reports the known safe error code and execution stage
   immediately, rather than running an irrelevant 175-second wait and
   misdiagnosing a provider timeout.
2. An isolated, pure receipt builder supplies only fixed checkpoints:
   `claimed`, `agent_loaded`, `runtime_prepared`, and
   `session_prepared`. A fixed allowlist of standard error class names
   may be present. It NEVER copies raw error messages, prompts, token
   values, stack traces, local path names, or arbitrary exception names.
3. When a **legacy** run reaches environment lease-release teardown
   still live and still in `preparing` before provider dispatch, Bostan
   best-effort records that receipt as an immutable lifecycle event
   *before* the existing safety fallback terminalizes the run. A
   receipt/write failure cannot inhibit lease teardown or fabricate a
   completed run. Existing native-run release logic remains unchanged.
4. Tests ensure `interrupted` is terminal, queued/running are not, and
   malicious diagnostic content cannot escape via the E2E error.

## Qualification limits

The new diagnostic identifies where a subsequent failed setup stopped.
It **does not itself fix the unknown original setup failure**, nor does
it establish Windows end-to-end agent completion. There is no unattended
retry, no concurrent active run duplication, no real user content, no
paid providers, and no modification of non-TEMP profiles.

Release NO-GO: full Windows agent issue/comment/heartbeat success,
consumer installer, cross-platform packaging, privacy, and performance
remain unqualified. No main merge, deployment, publication or Actions
enablement.
