# B0-89 — Read-only server static import graph baseline

2026-10-28. Private stacked Bostan engineering follow-up after B0-88. No production runtime altered, no release, no paid models, no external API access.

## Motivation

The isolated B0-87 native Windows authenticated server ran genuine PostgreSQL migrations, but remained at `BOSTAN_WINDOWS_LIVE_IMPORT_STAGE=static_import_start` for 182 seconds, never reaching `static_import_complete` or `startServer()`. A subsequent Windows compiler attempt could not complete while free disk space deteriorated. Both are OPEN, without a proven slow module.

## Read-only analysis

New `scripts/bostan-server-import-graph.mjs --inspect` traverses local TypeScript/JavaScript static import/reexport statements from `server/src/index.ts`. It does **not** execute the server, import dependencies, open network access, write output files, install packages, run providers or alter production files.

On the B0-89 branch, a macOS source-only run reported:

| Statistic | Observed |
|---|---:|
| Local server source files scanned | 1,814 |
| Direct relative/local imports from index.ts | 76 |
| Unique locally reachable modules, including index.ts | 1,390 |
| Distinct bare import specifiers across scanned source files | 155 |
| Reachable local modules via app.ts | 1,357 |
| Reachable local modules via services/index.ts | 891 |
| Via native-harness-backup-expiration.ts | 648 |
| Via native-session-executor.ts | 647 |

Branch reach counts **overlap**; they cannot be added. The count of bare package imports is for the entire scanned directory, not necessarily the entry-point closure. This is a **conservative lexical estimate**, not a complete TypeScript/Node runtime dependency graph: it omits dynamic imports, require(), package-level transitive imports, condition resolution and runtime initialization cost. Type-only import handling is best effort. Do not diagnose app.ts as the bottleneck merely because it has the largest reach.

Mac Node test suite: **4/4 PASS, 0 fail, 0 skipped**. Native Windows 11 Node 24.19.0, an isolated Bostan B0-89 branch checkout with no dependency installation: **4/4 PASS, 0 fail, 0 skipped**, read-only CLI **exit 0**. Mac and Windows independently reported the exact same source metrics (1,814 files scanned, 76 direct local imports, 1,390 reachable local modules). Tests cover multiline import/reexport, type-only and dynamic exclusion, cyclic imports, shared dependency deduplication, foreign entry refusal and default inert invocation.

## Next action

Build a bounded **module-load/evaluation timing** probe that can isolate real Windows runtime costs without dumping secrets or exceeding disk/CPU budgets. Consider reducing startup-only import reach or using a staged, tested compiled runtime, but make no behavior-changing refactor based solely on this graph. B0-87 Windows source server HTTP readiness, auth/browser, complete builds, free-agent completion, installers and security reviews remain OPEN.

**Bostan overall release NO-GO.** Repo PRIVATE, Actions OFF, main untouched.
