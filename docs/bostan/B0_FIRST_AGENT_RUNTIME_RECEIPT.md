# B0-12 — First real AI agent execution, local OpenCode compatibility

**Status: partial first-agent integration qualification on macOS. NO-GO for release.**

- Parent: B0-11 private Draft PR #39, commit `990d4919de8d5cace58814b9ae6ab5542dda7596`.
- Branch: `work/b0-first-agent-free-smoke`.
- Device: authorized macOS 8 GB Apple Silicon, Node 26, PostgreSQL 17, installed OpenCode CLI.
- Everything under a disposable /tmp Bostan HOME and throwaway empty workspace; no real user profile, customer files, API keys, or purchased cloud resources accessed.
- A provider/model marked free (`opencode/beam-free`) was used with synthetic non-sensitive prompts. It required internet connectivity; **this is NOT offline inference**. The run accounting reported **costUsd = 0**, billingType = unknown. That does not guarantee future cost or availability.

## Findings and repairs

1. OpenCode's current CLI recognizes `opencode run --standalone`, but the default background-service command collided with another listener on its runtime port in the temporary test environment. Direct, isolated standalone invocation returned the expected synthetic text.
2. Existing `opencode_local` agent lifecycle probes were failing `harness_test_failed` (the direct lifecycle used an OpenCode background service).
3. An explicit `extraArgs: ["--standalone"]` allowed a new legacy OpenCode agent to pass lifecycle verification, becoming `ready`.
4. Initial agent dispatch then failed because the adapter automatically appended `--dir <workspace>` to `opencode run`. The installed current CLI rejected `--dir` (error: "Unrecognized flag: --dir in command opencode run"). The process execution already passes a working directory, so the extra flag was unnecessary.
5. Fixed OpenCode adapter dispatch by no longer injecting deprecated `--dir`, while preserving operator-supplied arguments.
6. Bostan's isolated source application sets `BOSTAN_OPENCODE_STANDALONE=1`. Local OpenCode **probe and execution** paths insert `--standalone` exactly once, without changing remote/SSH/sandbox execution or other users' ambient OpenCode launches. The option never gets inserted after an operator's `--` terminator.
7. A second agent created with only the `opencode/beam-free` model and `runner: legacy` (no special `extraArgs`) completed actual Bostan's lifecycle verification: **ready**. No new API key.
8. A real Bostan task assigned to an isolated legacy OpenCode agent was handled through the actual Bostan API. The agent added a task comment containing the exact marker `BOSTAN_REAL_AGENT_PASS` and set the task status to **done**. This result was verified by querying the persisted task and its comments.

## Honest remaining failure

The corresponding heartbeat run **did not finish cleanly**: it ended as `timed_out`, exit code 130, after the agent had already marked the task done. The free model continued a multi-step tool loop and exceeded the configured 110-second adapter timeout. Run accounting recorded 65,618 input and 3,503 output tokens, with reported cost of 0 USD.

Thus:
- **Proven:** free-provider response in an empty HOME; agent can reach ready; task creation/assignment, genuine model-driven execution, Bostan API comment and task completion.
- **NOT proven:** a completed successful heartbeat run, bounded tool-loop termination, full native default Paperclip Runner execution, multi-agent reliability, any offline-only provider, or general cost-free service.
- Required follow-up: cap/troubleshoot post-completion tool calls and ensure that completing the issue produces an intentional, auditable run termination without relabeling a timeout as success. Re-test with both legacy and native default runners.

## Tests

- `pnpm --filter @paperclipai/adapter-opencode-local typecheck` — PASS.
- `pnpm exec vitest run packages/adapters/opencode-local/src/server/local-standalone.test.ts packages/adapters/opencode-local/src/server/execute.test.ts packages/adapters/opencode-local/src/server/execute.remote.test.ts` — **26/26 PASS**.
- `node --test scripts/bostan-local-runtime.test.mjs` — **4/4 PASS**.
- Actual disposable Mac PostgreSQL + Bostan server startup, lifecycle verification (ready) and task/comment persistence — PASS.
- Clean terminal heartbeat run — **FAIL** (`timed_out`).

Do not use this synthetic QA model setup as production security or budget qualification. The legacy adapter's automatic tool approvals are unsafe for untrusted or uncontrolled work without a sandbox.

No publishing, deployment, release, registry operation or main merge is authorized. GitHub Actions stay disabled. **Release status: NO-GO.**
