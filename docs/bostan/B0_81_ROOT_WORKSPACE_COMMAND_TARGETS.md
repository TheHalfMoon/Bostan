# B0-81 — Repair first-party root command targets after Bostan workspace rebrand

**Date:** 2026-10-28. Private stacked Draft on B0-80 PR #229 (`6a0da8e11f1e3a5a5421ac3928b999d8c820a618`). Keep repository PRIVATE, Actions OFF, no main merge, publishing, deployment or paid models.

## Actual functional bug

The root `package.json` still included executable commands pointing to removed `@paperclipai/db` and `@paperclipai/paperclip-runner` workspace package names, even though source manifests are named `@bostan/db` and `@bostan/runner`. This means `db:generate`, `db:migrate`, and `test:runner-workflow-evals` could select no workspace package and silently fail to carry out the requested work. It is a *real CLI/workspace routing bug*, not only a cosmetic naming issue.

## Fix

- `db:generate` -> `pnpm --filter @bostan/db generate`
- `db:migrate` -> `pnpm --filter @bostan/db migrate`
- `test:runner-workflow-evals` -> build `@bostan/eval-kernel`, run evals on `@bostan/runner`.
- Preserve all underlying database migration contents, schema, runner protocol IDs, release policies, license terms, source paths and lockfile. **No database migration was run against customer or external data.**

New `scripts/bostan-root-command-targets.test.mjs` derives the expected package targets directly from the **actual current package manifests**, verifies that all requested package scripts exist and rejects any `@paperclipai/` targets in all root executable scripts. It prevents the removed package names being reintroduced when individual subdirectory paths remain named `paperclip-runner` for compatibility.

## Scoped verification

- Mac ARM64 Node26: native source tests **3/3 PASS**. `pnpm --filter @bostan/db list --depth -1`, `@bostan/runner`, `@bostan/eval-kernel` all select the actual private workspace package successfully.
- Windows 11 Node24.19 / pnpm9.12.0: native package-selection and new source tests require a separate actual run, with no PostgreSQL schema changes.
- A native Windows UI/typecheck and real PostgreSQL acceptance is **not implied by package metadata checks**; full Windows installed-application qualification remains open.

## Broader assessment

An exploratory **synthetic** call to external OpenCode `opencode/beam-free` with isolated HOME, stripped provider credentials and an empty temporary project returned **no answer in 90 seconds** and timed out. The temporary directory was deleted and no model/provider calls were made through Bostan. That probe is **not** evidence that a real free-model Bostan task succeeded, nor proof of zero cost or guaranteed free future capacity. The Bostan agent/model completion gate remains OPEN. No real files were passed in the prompt.

Keep all stacked changes Draft/unmerged; Bostan release **NO-GO**.
