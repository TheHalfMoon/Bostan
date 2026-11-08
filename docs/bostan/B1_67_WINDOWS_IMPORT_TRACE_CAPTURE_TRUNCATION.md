# B1-67 — Private Windows import trace truncation admission

Status: **TEST-HARNESS DIAGNOSTIC ONLY — RELEASE NO-GO**. Exact stacked parent: B1-66 Draft PR #320 at `6d5c218cd47da944de5c90f57c2904835f12749d`. PRIVATE, ZERO-COST, NONPUBLISHING; no production server, main, Actions, release, cloud, customer data, or foreign process changes.

## Independently identified diagnostic integrity gap

The Windows packed import probe retained only the final 65,536 characters of combined child stdout/stderr, but did not report whether earlier observations had been discarded. A long trace could therefore present apparently definitive stage/evaluation counts even though the first portion was missing. This is **not evidence of a product bug or an actual truncated production run**; it is a fail-closed diagnostic integrity gap.

## Minimal fix

- Keep the existing in-memory 65,536-character cap and private QA guard, but track whether any data was discarded. The flag is sticky across subsequent chunks, including a single oversized chunk.
- Emit only two new constant boolean receipts: `BOSTAN_WIN_IMPORT_ONLY_TRACE_CAPTURE_TRUNCATED` and `BOSTAN_WIN_IMPORT_ONLY_COUNTS_COMPLETE`. On truncation, force diagnostic EXIT 1. No raw stdout/stderr, paths, secrets, DSNs or source are printed or persisted.
- Preserve the bounded 36-second child deadline, cancellation, SHA256 runtime ownership, synthetic rejecting PostgreSQL stub, cleanup and release disqualification.
- All trace counts remain **observations only**. `COUNTS_COMPLETE=true` means only that the rolling capture did not discard characters; it does not establish absence of unobserved events or successful startup.

## Native Windows evidence — 2026-10-30

- Repository verified PRIVATE, main SHA `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a`, main `protected:false`; exact Draft #320 head and Draft #319 parent verified via GitHub. Authorized Windows device online; Mac offline. Windows preflight approximately 3.58 GiB RAM, C: 3.48 GiB, D: 6.18 GiB free; 14 existing Node processes and zero PostgreSQL processes. Existing workspaces/processes untouched.
- Isolated `D:\Bostan-B167-qa` Git worktree at exact parent SHA; original B166 clean. A new test initially RED with `ERR_MODULE_NOT_FOUND` before implementing the capture helper.
- Focused native Node 24 tests **10 PASS / 0 FAIL**, and expanded import/chunk tests **27 PASS / 0 FAIL / 2 SKIP** (Windows symlink privileges). JS syntax and `git diff --check` PASS.
- No heavy build, 36-second import probe, real PostgreSQL, Chromium, Better Auth, semantic TypeScript check, or installer test was run. This stage cannot qualify #234/#237.

## Remaining gates

Diagnose intermittent Windows packed ESM evaluation/startup delay with bounded, trustworthy evidence; positively identify a fix before re-running real packed HTTP/Better Auth/Chromium and one genuine PostgreSQL with 12 concurrent writes, independent multi-suite no-orphan proof, Linux and installer qualification, offline agent sandbox, security/privacy and license/NOTICE checks. **Release NO-GO.**
