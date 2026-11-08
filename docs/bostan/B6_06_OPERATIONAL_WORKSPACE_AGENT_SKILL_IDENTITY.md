# B6-06 — Operational workspace, agent tool and skill UI identity

**Private source-only development Draft PR. Not deployed, published, released, or merged. No paid services. GitHub Actions remain disabled.**

## Copy-first update

Update end-user English product copy to say **Bostan** in four operational screens without rewriting any runtime APIs, external providers, system IDs, or storage keys:

- Agent Tools: connection verification errors, responsible-person GitHub connection explanation, tool permission approval language.
- Project Workspace: local checkout description, workspace assignment semantics and Services/Jobs JSON guidance.
- Execution Workspace: actual run creation/toast/error copy, provisioning field hint, reused-workspace and port-conflict explanations.
- Agent Skills: stable prompt-bundle description and supported/unsupported adapter guidance.

Do **not** rename the actual legacy `paperclip_runner` adapter ID or its legacy operational skill; this remains a real compatibility marker and is not a fabricated claim that the legacy skill is rebranded or supported by Bostan Runner. Original license and required legal attribution remain untouched.

## Guarding change

Extend `scripts/bostan-agent-interface-brand.test.mjs` with four Bostan-copy fixtures and checks that three operational screens cannot reintroduce the previous product identity. Verify the Agent Skills copy and explicitly preserve the underlying protocol ID and legacy skill context.

The file changes are literal human-visible strings only; they do not alter component structure, state, endpoints, permissions, command execution, or APIs.

## Verified Mac qualification — 2026-10-25

After Desktop Commander was reconnected, the exact B6-06 head was fetched into an isolated Bostan checkout and the previously unavailable local validation was performed successfully.

- Local Bostan identity Node tests: **6/6 PASS**.
- Vitest focused UI tests for AgentToolsTab, ProjectWorkspaceDetail, and ExecutionWorkspaceDetail: **27/27 PASS** (three test files). React emitted non-blocking act(...) warnings for some presence-related asynchronous state.
- Bostan general Node source regression: **114/114 PASS, 9 Windows-only tests SKIPPED** (123 tests total).
- UI TypeScript check (pnpm --filter @paperclipai/ui typecheck): **PASS**, with structural Storybook catalog of 316 files and 2973 stories. This does not execute Storybook journeys.
- UI Vite production bundle (pnpm --filter @paperclipai/ui build): **PASS**. Existing chunks larger than 500 kB caused size/code-splitting warnings; no measured performance claim.
- Alibaba Open Code Review (ocr delegate preview on this branch relative to B5-26): **PASS**, five relevant changed files selected out of six; local static delegation and rules, **not** an AI reviewer or paid LLM.
- git diff --check: **PASS**.

## Remaining limits

These checks qualify the changed source copy and UI compilation, not a real installed Mac or Windows browser journey, production-like user acceptance, autonomous agent model behavior, B4 knowledge/analytics, B5 independent native review or an external security audit. Full release remains **NO-GO**.

The source branch remains on a private GitHub Draft PR, with inherited Actions disabled, no main merge, deployment or publication. Original required license/attribution and protocol identifiers remain intact.
