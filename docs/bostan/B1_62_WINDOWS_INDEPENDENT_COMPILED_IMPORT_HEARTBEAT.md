# B1-62 — Independent Windows packed import thread liveness, no PostgreSQL

Date: 2026-10-30. Strictly PRIVATE, zero-cost, NONPUBLISHING; stacked parent B1-61 Draft #315 exact HEAD `049600acc84b650f1e1634c485a98ed038b68e2b`.

## Real problem: why the old timer was ambiguous

The B1-60 native Windows combined PostgreSQL/Chromium E2E failed **before HTTP readiness**, showing `static_import_start` for 180 seconds while the same-JavaScript-thread `setInterval` never emitted `static_import_pending`. That is **not** enough to conclude a code deadlock or identify a module: timers cannot fire while synchronous ESM evaluation monopolizes the main event loop.

This B1-62 **test-only** diagnostic adds an independent, `unref()`-ed native Node Worker, created only after the existing compiled-mode private QA entry preloader and explicit BOSTAN test marker are admitted. The Worker receives **no inherited environment** (`env:{}`), no worker secrets, no child process, and uses only `node:fs` and `node:worker_threads`. Its sole effects are direct `fs.writeSync(2, FIXED_LITERAL)` calls on the inherited OS stderr descriptor: one `static_import_worker_alive` and a `static_import_worker_pending` every 30s. Direct OS writes deliberately do not depend on the main thread forwarding Worker console/stderr events. Unrecognized source errors are never emitted; worker failure is a fixed `static_import_worker_failed` token. It cannot keep the Bostan child alive after completion.

Both original Windows real HTTP/PG test and 36-second **no-PostgreSQL** CPU import probe now parse only fixed allowlisted Worker stage names alongside existing exact stage tokens. Added a bounded `classifyPrivateWindowsImportHeartbeat()` that differentiates `worker_timer_seen_main_timer_not_seen`, `both_timers_seen`, `worker_failed`, `worker_started_main_timer_not_seen` or `insufficient_evidence`. This emits **only closed vocabulary** and `releaseQualified:false`. The observation does not assert a particular CPU, I/O, deadlock or source-module cause.

## Actual native Windows evidence, not simulation

At source `0655eaa9178dc30a09465db3c6048be975b57222`, synthetic native Windows Node tests confirmed that an **intentionally blocked main JavaScript event loop** did *not* prevent the independent Worker from writing `static_import_worker_alive` on the exact owned guard-admitted child. Negative invalid marker preflight remained denied. With final classification integration source `8ad6b28f170f7f1faefa0b314c7d29177d4e92dd`:

- **Native Windows focused Worker + guard + classification test suites 11/11 PASS, 0 skips**, including real synthetic blocking child, strict privacy/bounded categories, and no persistent DB.
- An initial 36-second no-PostgreSQL probe attempt **REFUSED before test startup**: 2.78 GiB Windows RAM free below the separate conservative 3 GiB guard. This is a correct resource refusal, not a test failure or excuse to kill an unowned process.
- When Windows recovered to **4.89 GiB free RAM** and **7.54 GiB free D:**, executed actual `node scripts/bostan-private-windows-packed-import-probe.mjs --run` in verified B144 QA checkout with exact owned TEMP. **Actual 36-second bound was reached, child stopped without forced termination and no real PostgreSQL was ever started.** Only the QA-owned local dummy TCP PostgreSQL port was present.
- Exact actual safe receipts:
  - `BOSTAN_WIN_IMPORT_ONLY_OUTCOME=bounded_36s`
  - `BOSTAN_WIN_IMPORT_ONLY_FIRST_STAGE=static_import_start`
  - `BOSTAN_WIN_IMPORT_ONLY_LAST_STAGE=static_import_worker_pending`
  - `BOSTAN_WIN_IMPORT_ONLY_STAGE_COUNT=3`
  - `worker:timer_observed, main:start_only, finding:worker_timer_seen_main_timer_not_seen`, `releaseQualified:false`.
  - `BOSTAN_WIN_IMPORT_ONLY_CHILD_CLOSED=true`, `BOSTAN_WIN_IMPORT_ONLY_FORCED=false`, `BOSTAN_WIN_IMPORT_ONLY_REAL_POSTGRES_USED=false`.
  - **`BOSTAN_WIN_IMPORT_ONLY_CPU_PROFILE=unavailable`**, hence the diagnostic runner itself returned **EXIT 1** by its existing fail-closed CPU-profile rule. **Do not call the entire CPU-profiler run GREEN**, or infer which module/function is at fault. Its independent heartbeat liveness observation is valid at this source and hardware envelope.
  - `BOSTAN_WIN_IMPORT_ONLY_OWNED_FIXTURE_CLEANED=true`.
- **Independent postrun Windows scan:** 0 PostgreSQL processes, 0 owned B144 Node processes, 0 owned bounded-import fixture dirs, 0 tracked checkout changes; D: remained 7.54 GiB free.
- Mac Node focused startup/classifier/HTTP guard tests **16 PASS, one native Windows-only skip**, no failure. Windows named synthetic source/worker/tests are all in Git; no raw CPU source profiles, user/credential paths or model logs copied into repo.

## What is now more certain, and what is not

A separate OS thread ran and emitted a later timer during the same compiled-runtime import period while the main Node timer did not run. This is **consistent with a main-event-loop-blocking synchronous load/evaluation**. It does **not** prove an infinite loop, identify an individual ESM chunk or dependency, or separate long CPU computation from blocked synchronous I/O. Windows Defender, filesystem latency, loader scheduling and other factors have **not** been ruled out.

The next gate is a privacy-safe **CPU vs I/O/activity** attribution for the exact owned Node import process; the old built-in `--cpu-prof` did not produce a usable file on bounded SIGTERM and must not be reported as successful. Do not extend the 180s HTTP deadline or disable startup/resource/ownership checks to disguise the issue. Only rerun actual Windows PostgreSQL + Chrome + 12 same-DB issue writes after the bundled server becomes HTTP-healthy within the original bound and independently cleanly shuts down.

**Release NO-GO**. Full Linux runtime/installers, production-grade autonomous agent sandbox/effects consent, sustained load/transaction testing, complete security/privacy/license/NOTICE/provenance/branding remain unqualified. No public release, package publish, Actions, protected-main merge, model costs or customer data.
