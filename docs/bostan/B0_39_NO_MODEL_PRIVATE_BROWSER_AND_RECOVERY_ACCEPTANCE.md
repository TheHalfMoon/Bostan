# B0-39 — Real private Bostan browser, persistence, agent-draft and cold-recovery acceptance

2026-10-27. Draft-only stacked source qualification above B0-38. Private repository, no `main` merge, public release, deployment, inherited Actions enablement or paid model/provider calls.

## Execution

Reused the previously authored `scripts/bostan-local-live-persistence-e2e.mjs` rather than creating a second unreviewed runtime/Playwright framework. On the authorized Mac, in a new temporary private HOME/database, first built UI production assets with `pnpm --filter @bostan/ui build`, and confirmed `node cli/src/bostan-preview.mjs app doctor` reported prerequisites satisfied. Ran these *separate*, no-model localhost E2E cases using the project's real launcher, real PostgreSQL and installed Playwright Chromium:

1. **App persistence:** live Bostan health, create a synthetic company through real `/api/companies`, orderly stop, restart, read back exact company ID/name, clean stop — **PASS**.
2. **Browser onboarding:** launch real UI against real restarted server, complete synthetic company onboarding. Browser JS errors **0**; external HTTP and WebSocket requests **0** — **PASS**.
3. **Inactive first-agent draft:** real browser new-company wizard, save inactive first-agent draft and select an adapter while the agent stays paused (no inference) — **PASS**, zero browser page errors/outbound requests.
4. **Native Bostan cold backup/restore:** stop the actual embedded local PostgreSQL, create cold snapshot, verify **3,420** manifest files, restore into **a brand-new HOME**, restart on restored database, verify company persistence and browser — **PASS**. Browser page errors and external requests **0**.
5. **Task privacy/insights:** create synthetic issue(s), browse real dynamically loaded issue route, inspect task insights, verify HTML referrer privacy from real HTTP server — **PASS**, browser page errors and external requests **0**.

Each independent E2E returned `BOSTAN_LOCAL_PERSISTENCE_E2E_PASS`, with `qualified:true` scoped *to the listed scenario*, and terminated its owned test server/DB after completion. None ran OpenAI/Anthropic/Gemini/OpenRouter etc. Env credentials were absent from the execution.

## Reusable no-model acceptance command

Added `scripts/bostan-no-model-acceptance.mjs`. Its **default `--plan` is read-only**; an explicit `--run <scenario>` executes one of the five scenarios above, or `--run all` sequentially. Before each child scenario it strips external model credential variables, inherited DATABASE_URL, model E2E opt-ins, telemetry/export URLs, and injects Bostan's `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1` only for the disposable execution. It does not download/install models or browsers; it requires local built UI/runner/server, Postgres CLIs and installed Chromium. Failures terminate the batch. The wrapper is macOS/Linux only and rejects unsupported platforms, where Bostan requires separate Windows TEMP-only QA.

- New wrapper read-only plan, flag admission, credentials/safety unit suite: **3/3 PASS**.
- Actual invocation `node scripts/bostan-no-model-acceptance.mjs --run persistence`: **PASS**, with `BOSTAN_NO_MODEL_ACCEPTANCE_PASS` receipt.
- The remaining four scenarios were run independently with equivalent explicit E2E environment settings before creating the wrapper, not yet as a single `--run all` batch. Do not claim full wrapper batch execution.
- Maintained preserved third-party notices, historical persisted wire IDs, compatibility env keys and no-publish controls.

## Release qualification state

Real source QA on macOS does **not** qualify native compiled Rust daemon, installed macOS/Windows/Linux distribution, paid/free *live agent* efficacy and provenance, signed APIs and independent governed-case reports, actual existing customer-data upgrades or full security review. Windows device was offline during this QA, and native governed Case preflight requires **8 GiB free temporary disk and at least 12 GiB RAM/6 GiB free memory**; Mac had approximately 5.7 GiB free disk. Consequently neither a real model nor native Rust full qualification was attempted. No release approval. **Release NO-GO**.
