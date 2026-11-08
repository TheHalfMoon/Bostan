# B0-13 — Opt-in bounded OpenCode agent turns and real completion

**Private development qualification only; do not merge or publish. Release NO-GO.**

- Parent: Draft PR #40, commit f662ef29e24fea371ec7cd40979cd9cdba195b19.
- Working branch: work/b0-opencode-step-budget.
- Platform: authorized macOS host, Node 26, PostgreSQL 17, OpenCode CLI.
- No user profile modifications, no paid models and no production secrets. All
  Bostan organizations, tasks and agent home directories were disposable.
- The models used were free-labeled online models, **NOT local offline inference**.

## Feature

An optional legacy OpenCode adapter config field `maxAgentSteps` (integer 1..128)
restricts the number of OpenCode **build agent steps**. This is a maximum
reasoning/tool iteration count, not a hard token budget, dollar limit or
model guarantee. Existing lower limits (including explicit inline
`OPENCODE_CONFIG_CONTENT`) remain in force, and the injected cap is included
in both generated and inline config so it cannot be silently shadowed.

The option is opt-in: agents that omit it keep their prior behavior.
Remote/sandbox OpenCode runs with the field explicitly set are refused
until their remote config transport can enforce the cap. No misleading
confirmation of a limit on those targets.

The explicit online free-model smoke harness now opts in to `maxAgentSteps=12`
and will only select one of two preapproved test models:
`opencode/deepseek-v4.1-flash-free` or `opencode/beam-free`. Paid/unexpected
models fail closed before any API request.

## Verification results

1. **52/52 adapter Vitest checks passed** after implementation, including 26
   runtime config tests, 5 standalone-mode checks, and 21 execution tests.
2. **10/10 Node checks passed** before the allowlist extension, including
   scoped disposable-HOME E2E permissions and runtime guards.
3. A separate model-allowlist scope test passed (**7/7** scope checks).
4. Adapter TypeScript typecheck PASS.
5. **Live Bostan end-to-end, DeepSeek free-labeled model** (maxAgentSteps 12):
   new synthetic company+agent, actual lifecycle ready, task assigned,
   model-driven comment `BOSTAN_CLEAN_RUN_PASS`, status done, **run succeeded,
   exit code 0**, reported usage cost 0 USD.
6. **Live Bostan end-to-end, beam-free model** (maxAgentSteps 12):
   new synthetic company+agent, actual lifecycle ready, task assigned,
   model-driven comment `BOSTAN_CLEAN_RUN_PASS`, status done, **run succeeded,
   exit code 0**, reported usage cost 0 USD. This contrasts with B0-12 where
   beam-free completed a task but then exceeded the 110 second runtime timeout
   without a step budget. This limited experiment does not prove step caps
   guarantee successful outcomes on future invocations.

## Known limits and release gates

- Free third-party model access depends on future provider terms and may not
  be available. Usage records with costUSD 0 are per-test observations, not
  future free-spend promises.
- `maxAgentSteps` does NOT guarantee monetary or token spending limits, nor
  full crash-safe termination and remote adapter compatibility.
- The successful integration tests use the **legacy** `opencode_local`
  adapter; the native default `paperclip_runner`, cross-platform installer
  packaging, untrusted model sandbox, egress audit and offline inference
  still need full qualification.
- To rerun the opt-in smoke, see `cli/README.md`; never point it at a
  non-disposable HOME. This smoke is not run by CI automatically.

**NO-GO. Source stays in private Draft PRs; main remains unchanged and GitHub
Actions disabled.**
