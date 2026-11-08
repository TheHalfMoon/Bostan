# B0-92 — Real macOS source-index cold import and bounded module-load proof

2026-10-28. PRIVATE Bostan engineering wave stacked on B0-91 PR #242, no merge, release, publishing, paid model inference or operator/customer data.

## Motivation

Native Windows B0-87 real synthetic PostgreSQL migrated successfully but `server/src/index.ts` static import did not complete in 182 seconds. C: free disk was later measured as 0.10–0.14 GiB and B0-91 correctly refuses unsafe heavy Windows runs. B0-89's source-only graph estimated 1,390 reachable local modules, while B0-90 created guarded native Node loader profiling. We need cross-platform *runtime* evidence before making unproven startup refactors.

## Mac native preparation and results

In isolated `/private/tmp/bostan-b092` checkout on Mac, 21 GiB starting free, using native Node **24.15.0** and repository-locked **pnpm 9.15.4**:

- Frozen scoped install for `@bostan/server...`, **805 packages**, ignored install lifecycle scripts. An initial `--offline` attempt failed because `@1password/sdk@0.5.0` was not cached; a subsequent locked public npm package fetch completed. No AI-provider/model requests and no deployment.
- Built `@bostan/shared`, `@bostan/db`, `@bostan/adapter-utils`, `@bostan/plugin-sdk`, and then **17 internal workspace projects excluding @bostan/server and @bostan/runner**. The database build verified **375 SQL migrations** and byte-preserving copy, Skills Catalog generated **17 entries**, and Shared's legal-notice copy validated. All selected builds exited **0**. No compiled server, full runner build, native server or browser claim.
- First controlled `node --import tsx` dynamic import of **actual** `server/src/index.ts`: **11,207 ms** (no profiler), exit 0. It intentionally did **not** invoke `startServer()`.
- Second actual import with B0-90's module hooks and synthetic opt-in: **10,368 ms**, **5,579 load-hook calls**, **23,275 resolve-hook calls**, **7 nonfatal hook errors**, 88 profile snapshots, **4,671 ms aggregated load-hook time** and **1,962 ms aggregated resolve-hook time**. The largest observed single load was in a third-party package (**223 ms**); `packages/paperclip-runner/src/protocol/generated/standalone-validators.ts` ~67 ms, `server/src/routes/issues.ts` ~65 ms and `server/src/index.ts` ~61 ms. These sums are NOT additive wall-clock contributions and top loads do not identify a Windows root cause.
- New repeatable opt-in `scripts/bostan-private-mac-source-import.mjs --run`: **10,181 ms**, **5,579 loads**, **23,275 resolves**, **7 nonfatal loader-hook errors**, **4,450 ms summed load-hook time**, exit 0 and `macSourceImportQualified:true`. Its default `--plan` is inert, and it refuses `--run` absent `BOSTAN_MAC_SOURCE_IMPORT_QA=SYNTHETIC_ONLY`, isolated real `/private/tmp/bostan-b0xx` repository, required built package artifacts, and sufficient disk headroom. Synthetic HOME/TMPDIR/PAPERCLIP_HOME, fake loopback database URL and **minimal allowlisted environment** ensure user secrets are not inherited; a bounded 60-second subprocess is cleaned up. Parent prints only approved numeric receipt data, not process output or secrets. The child dynamically imports but does NOT start the HTTP server.
- **4/4 tests PASS** for default no-op, invalid/publication action denial, missing opt-in refusal and synthetic-only/run-time/process limits. All commands local except the explicit locked npm registry fetch. Approximately **17 GiB** free after the run.

## Qualification limits / next

This establishes that the real Bostan source index *can be imported* in ~10–11 seconds on one healthy Mac. It does **not** prove a live authenticated HTTP server, PostgreSQL boot with configured app, first-admin session, Playwright Chromium, real no-cost agent tasks, complete compiled/installer artifacts, or release security. Nor does it prove that Windows C: disk scarcity is *the* cause of the earlier 182-second hang; resource-starved Windows import and healthy Mac import are not directly controlled-equivalent.

Keep B0-91's minimum 2 GiB free on Windows C:, 6 GiB on checkout/TEMP before heavy native tests. The B0-90 profiler can be applied to a resource-qualified real Windows source server to distinguish continued resolution/load activity from top-level module evaluation; compare snapshot progression and use small, reviewable refactors based on evidence.

**Bostan release NO-GO**, repo PRIVATE, GitHub Actions OFF, this wave is a stacked Draft only.
