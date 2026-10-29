# B1-45 — Native Windows packed server: startup catch, not a proven stuck static import

Date: 2026-10-29. PRIVATE / ZERO-COST / NONPUBLISHING. Base is Draft PR #298 at exact commit `6bcbdbb54c90089151530ec5d7997a6bcab45337`.

## Correcting the earlier inference

Earlier Windows diagnostics at B1-42/B1-44 observed only the preloader's `static_import_start` and a packed child exit 1. That **does not prove a static import failure**: the compiled `dist-runtime/index.mjs` dynamically imports bundled `server.mjs`, whose retained Bostan main-module guard invokes `startServer()` and independently handles errors; it does not write the source-only `static_import_complete`/ `runtime_start` stage markers.

Independent read-only examination of the **actual SHA256-owned native Windows B144 `server.mjs`**, ~6.6MB, found exactly two `process.exit(...)` call sites: graceful exit 0 and startup catch exit 1. A new test-only, pre-guarded diagnostic preload (never production server code) captured the **real `process.exit(1)` caller class as `packed_server`** and no uncaught exception event. The parent's exact existing `logger.error({err}, "Bostan server failed to start")` marker was observed.

## Actual native Windows QA evidence

- Test-only `uncaughtExceptionMonitor`, `beforeExit`, `exit` and non-suppressing, behavior-preserving `process.exit` capture were added after the existing strict QA guard; they output **only allowlisted error classes/codes, process-exit caller categories and bounded numeric fields**. No raw stack, sensitive log message, filenames, URL, credentials, model calls, or external network.
- Native Mac+Windows run of synthetic unit suite **12/12 PASS** at source commit `d0f54da0619c6373de8a4bcc2336a3ed8acc77cc`, with safety tests for forged external paths and private error messages.
- Real Windows B144 exact-ownership packed runtime test still uses a single held loopback dummy PostgreSQL socket that deliberately destroys any connection. It generated `BOSTAN_WIN_IMPORT_ONLY_SAFE_MONITOR` with `uncaught:null`, `exit:1`, `beforeExit:false`, `exitCalled:{code:1,site:"packed_server"}`.
- Native safe pretty-Pino startup log reducer found `startupFailureMarker:true`, `errorType:"Error"`, `allowlistedCode:"ECONNRESET"`, `messageCategory:"database_or_transport"`. This outcome **is expected** with the intentionally failing dummy database: the server reached its startup-error catch. It neither establishes a Windows import defect nor proves successful startup with a real PostgreSQL database.
- V8 profile collected and reduced locally; isolated probe subprocess exited on its own, no force; exact owned profiling scratch cleaned; **no real PostgreSQL started**.
- **Final exact B1-45 source HEAD** `35ff17edd947375635d126bd47ad06190cd45116` reverified on native Windows: **13/13 tests PASS**, real no-PostgreSQL packed diagnostic **EXIT 0 in 41.65s**, `BOSTAN_WIN_IMPORT_ONLY_PHASE=application_startup_failure`, `exitCalled:{code:1,site:"packed_server"}`, `errorType:"Error"`, `allowlistedCode:"ECONNRESET"`, `messageCategory:"database_or_transport"`, no uncaught exception. Bounded child exited naturally; no forced stop; exact temporary profile cleanup passed. These are findings about the intentionally failing dummy-DB mode, **not** real PostgreSQL startup qualification.
 Read-only post-run scan found no B144-owned node/postgres processes and only the B144 outer marker.

The new `BOSTAN_WIN_IMPORT_ONLY_PHASE=application_startup_failure` classifier refuses to infer that from a stage marker alone: it requires **both** actual `packed_server` exit-1 site and the exact startup-failure logger marker.

## Remaining real Windows production blockers — release NO-GO

Native Windows real PostgreSQL+Better Auth/first-admin+HTTP #237 previously timed out after 180s and had uncertain cleanup; issue #234 multi-suite database-orphan teardown remains not qualified. Those require a separately proven safe owned-PG cleanup path before rerun. A Mac Chromium+real packed PG 47-request journey is confirmed separately in #297, but Windows client qualification, native/Linux installers, genuine offline zero-cost agent, full typecheck, privacy/security/licensing/provenance are open. Keep PRIVATE, DRAFT only, NO protected-main merge, no publish/deploy/npm pack, no Actions enable, no paid models or customer data.
