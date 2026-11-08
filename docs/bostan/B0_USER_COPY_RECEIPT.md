# B0 — Product-facing application copy: implementation receipt

**Status:** development-only change stacked on B0 frontdoor identity; no production release qualification.

## Exact parent

- B0 frontdoor branch parent: `work/b0-rebrand-identity@ca9fe7e52c96ff84e1bcc46c32a23cf19345897d`.
- Stacked change branch: `work/b0-product-copy`.

## What changed

- Replaced standalone former product-name references with Bostan in a bounded allowlist of **22** production UI files.
- Pages include company invites, secrets, company environments, imports/exports, agent setup, task recovery/run ledger, routines, cost quality, install/browse and app settings.
- The exposed permission label now reads `Allow Bostan reads`. The canonical permission enum `approve-reads` and adapter identifiers are **unchanged**.
- Export's product reference points to the new private Bostan repository instead of an inherited external website.
- Changed tests only where product-facing copy or its sorted alphabetical position changed. User-specified company/agent fixture names and low-level `paperclip_runner` identifiers intentionally remain unchanged.

## QA — exact local results

- `pnpm --filter @paperclipai/ui typecheck`: PASS.
- `pnpm --filter @paperclipai/ui build`: PASS, inherited chunk-size warnings; no fatal compile errors.
- Targeted **14 test files, 329 tests**: PASS after aligning renamed visible strings in test assertions.
- `git diff --check`: PASS.
- Earlier test runs found 15, then 5 failures, all reconciled in subsequent exact-state runs; they were user-facing test expectations and one shared visible adapter label, not ignored or waived.

## Boundaries / remaining

Most inherited code symbols, package names, release workflows, upstream-origin docs, logos in other surfaces, third-party legal notices, and backend API response text remain unchanged. This branch is **not** a finished Bostan-wide rebrand. Do not make incompatible config/env/database migrations based on visible UI copy. No full-suite, end-to-end local agent, machine policy, production telemetry/egress or publishing qualification was performed.

Continue with safe CLI/package identity, startup/deployment endpoints, privacy defaults, and app-wide brand inventory in independently tested branches.
