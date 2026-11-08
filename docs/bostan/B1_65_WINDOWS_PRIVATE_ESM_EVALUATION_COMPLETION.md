# B1-65 — Windows packed ESM evaluation completion boundaries

Status: **DIAGNOSTIC ONLY — RELEASE NO-GO**. Strictly PRIVATE, ZERO-COST, NONPUBLISHING. Stacked on Draft B1-64 (#318) at `07a563ab575c1291662255e6d2b01549e052d3df`. No production server changes, main merge, GitHub Actions, paid inference/compute, deployment, npm pack, or customer data.

## Motivation

B1-64's native Windows SHA256-owned packed import probe was bounded to 36 seconds, observed **77 load-start and 77 load-complete markers**, but only **55 evaluation-entry markers** with no main-thread timer progress. A load-complete marker does not prove module body evaluation completed. The cause of the intermittent Windows startup delay remained unknown.

## Test-only implementation

- The existing guarded, opt-in Node 24+ synchronous ESM hook now appends a **completion** marker after the admitted packed module body, in addition to the existing entry marker. Each marker carries only the same 12-hex digest derived from a relative SHA-owned chunk name. The epilogue is skipped if top-level execution throws or blocks; successful top-level await reaches it. No raw paths, DSNs, source, credentials, or stacks are emitted by the probe.
- The parent prints bounded evaluation entry/completion counts, last digests, and at most four unmatched digests. A missing completion is **only a diagnostic observation**, not proof of the culprit, a deadlock, or production equivalence. A truncated 64-KiB capture can overstate unmatched entries.
- Existing strict private QA admission, SHA256 ownership, synthetic loopback rejecting PostgreSQL stub, 36-second deadline, child ownership/cleanup, CPU-profile fail-closed, and `TRACE_QUALIFIED=false` remain unchanged. No real PostgreSQL or Chromium is used.

## Executed native Windows evidence — 2026-10-30

- Authorized Windows Abdulaziz, Node **v24.19.0**, isolated `D:\Bostan-B165-qa` checkout at exact B1-64 parent SHA before changes. Separate matching `D:\Bostan-B165-temp` scratch, private QA marker; no original B144/B164 checkout edits.
- GitHub compare from B144 `f5db5d4b1b6eb699abe025d480ae5ee0beed760d` to B1-64 showed **zero server/package/lockfile changes**. Reused 238 generated packed runtime files and B144's compiled server entry in the isolated checkout, re-bound the owned manifest, and passed production `assertSafeRuntimeOutdir` SHA256 verification. Existing dependencies were referenced by junctions without modifying their targets. **This is not a fresh build or semantic TypeScript check.**
- Initial B1-64 exact-source native baseline: 77/77 load starts/completes, 55 evaluation entries, Worker timer seen but main timer not seen; bounded 36s, no CPU profile, EXIT 1, owned fixture cleaned.
- B1-65 evaluation-completion first native 36s run: **77/77 loads completed, 65 evaluation entries / 63 completions**; Worker timer seen, main timer not seen, CPU profile unavailable, EXIT 1, owned fixture cleaned. Two incomplete evaluation observations do **not** identify the responsible chunk.
- B1-65 second native run after adding bounded unmatched-ID summary: **77/77 loads completed and 77/77 evaluation entries/completions**, zero unmatched. Both Worker and main-thread timers observed; application reached startup and exited 1 with allowlisted `ECONNRESET` / `database_or_transport` because the test intentionally destroys connections to its synthetic PostgreSQL stub. The CPU profile was available and summarized only into fixed categories. This is **not a product failure with real PostgreSQL** and is **not a successful HTTP/Better Auth/Chromium qualification**. The different outcomes show the observed delay is not deterministic under this instrumentation; no root cause is proven.
- Native Windows focused QA tests after the changes: **41 PASS, 0 FAIL, 3 SKIP** (OS-specific/symlink conditions), across nine test files; targeted synthetic real Node ESM cases include successful top-level await with two completion markers and thrown top-level evaluation with no false completion. JavaScript syntax and `git diff --check` PASS.
- Before the probes, approximately 3.7 GiB RAM and 6.5 GiB D: space were free; resource preflight passed. No genuine PostgreSQL process was present. Both probe executions reported `CHILD_CLOSED=true`, `FORCED=false`, `REAL_POSTGRES_USED=false`, `OWNED_FIXTURE_CLEANED=true`. No foreign process was terminated.

## Interpretation and next gates

The diagnostic establishes that all 77 observed packed ESM loads can complete and that at least one Windows execution reached application startup, but it **does not** establish a stable production startup or explain the intermittent main-thread stall. Do not attribute causality to the last entry digest. Investigate timing variance, module evaluation and cold-cache behavior using only bounded privacy-safe evidence; only after a positively identified fix, rerun real Windows packed HTTP health, Better Auth, Chromium, 12 concurrent writes to one isolated genuine PostgreSQL, and independent multi-suite no-orphan checks (#234/#237). Linux native qualification, installers, untrusted agent sandbox, security/privacy/provenance/license/NOTICE remain gates. **Release NO-GO.**
