# B0-90 — Private native Node cold import hook profiler

2026-10-28. Private Bostan draft stacked on B0-89 PR #240. No main merge, release, cloud provider inference, or changes to customer data.

## Motivation

B0-87 native Windows authenticated server failed **before** `startServer()` and did not move beyond `static_import_start` during a bounded 182-second test, although PostgreSQL started and migrated normally. B0-89 found 76 local direct imports and 1,390 unique reachable local modules, but could not identify time spent loading them.

## Implementation

- `scripts/bostan-private-windows-import-profiler.mjs` uses Node's synchronous `registerHooks` for **actual module resolve/load events** in the private Windows QA child process. Requires `BOSTAN_PRIVATE_QA_ENTRY=B087_TEST_ONLY`, an owned synthetic marker, authenticated-private deployment, and loopback PostgreSQL URL. An unrelated server startup remains uninstrumented.
- Captures counts, aggregate hook durations, error counts, and up to five slow module **load-hook** operations. Module names are only Bostan source-relative paths or neutral categories; no absolute user paths, connection URLs or secrets. Bounded periodic snapshots after every 64 module loads and a final process-exit snapshot; the parent can extract the most recent safe observation even if no HTTP readiness occurs.
- The existing B0-87 live QA script opts in **only for the disposable synthetic child**, with Node `--import tsx --import ../scripts/bostan-private-windows-import-profiler.mjs` before the staged server entry. If HTTP fails, it reports enumerated module load counts, aggregate load milliseconds and sanitized slow module names before the existing fail-closed exit/cleanup.
- This is **not a module evaluation profiler** and does not measure arbitrary synchronous top-level function evaluation. It also cannot prove which package is slow if startup is stuck outside a hooked operation. Zero loaded modules may indicate a pre-loader stall; it is not a successful app run.

## Test evidence

macOS Node 26: 14/14 focused tests PASS, including the existing B0-86/B0-87 safety tests and five new profiler tests. These include actual Node hook registration in a **synthetic child**, mock resolve/load passthrough and error propagation, path redaction and a default-inert run. No database, real app server, paid AI model or cloud service was accessed in these focused tests.

Native Windows Node 24.19.0: pending isolated fresh checkout and synthetic fixture testing. A complete real Windows server and authenticated browser gate will still require separately installed locked dependencies and a disposable PostgreSQL fixture. No such success is claimed by this diagnostic-only wave.

Overall Bostan release: **NO-GO**, repo PRIVATE, GitHub Actions OFF, Draft PR only.
