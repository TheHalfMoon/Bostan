# B1-64 — private Windows packed ESM load-boundary diagnostics

Status: **DIAGNOSTIC ONLY — RELEASE NO-GO**. Strictly private, zero-cost, nonpublishing, and stacked on Draft B1-63 (#317) at `02d7f2fbade251b20429dc2c6c17d783cc8736ac`.

## Motivation

The last actual native Windows bounded 36-second probe at B1-63 entered the packed `index.mjs` module and reported a live independent Worker, but no main-thread timer progress or app HTTP readiness. The evaluation marker alone cannot identify whether the delay is inside module loading, module evaluation, or a dependency. B1-63's isolated dependency-complete follow-up still returned EXIT 1 due to the required unavailable CPU profile. No successful Windows E2E is claimed.

## Test-only change

- Extend the existing strict private-guarded `--run-trace` Node 24+ synchronous ESM load hook with **two distinct observations** for each admitted SHA-owned packed `.mjs` file: `BOSTAN_WIN_CHUNK_LOAD_START=<12 hex>` immediately before `nextLoad`, and `BOSTAN_WIN_CHUNK_LOAD_COMPLETE=<same 12 hex>` only after it returns.
- Validate the canonical owned runtime path **before** any marker, rejecting linked escapes. No foreign module is traced. The existing evaluation marker is unchanged; no production bundle, source, manifest, or application behavior is modified outside the opt-in diagnostic.
- The parent captures only bounded allowlisted marker vocabulary and emits load-start/load-complete counts and last digests, never file paths, raw stderr, stack traces, environment variables, credentials, or DSNs.
- A missing completion means the admitted `nextLoad` did not return **within the observed trace**; it is not a definitive attribution of a deadlock, CPU loop, or culprit chunk. A completed load followed by a missing evaluation marker likewise does not identify a culprit. Observations can be truncated by the existing bounded stderr capture.
- Existing 36-second deadline, SHA256 runtime admission, synthetic loopback rejecting database stub, resource/ownership preflight, guarded preloader, child cleanup, CPU-profile fail-closed rule, and `TRACE_QUALIFIED=false` are unchanged. No real PostgreSQL, Chromium, or production app qualification is added.

## Executed evidence (2026-10-30, Mac Node 26)

- Isolated private Git clone from exact #317 head, no edits to existing Mac/Windows QA checkouts.
- `node --check` for modified scripts: **PASS**.
- `node --test scripts/bostan-private-windows-chunk-eval-trace.test.mjs scripts/bostan-private-windows-import-probe-outcome.test.mjs`: **10 PASS, 0 FAIL, 0 SKIP**.
- Real synthetic Node ESM hook: two packed modules yielded **2 load-start, 2 load-complete, 2 evaluation** markers and the expected value; no absolute path appeared in stderr.
- Negative tests: foreign module emits no markers; owned `nextLoad` throw leaves start without false completion; symlink escape is denied before any marker; unowned preload refuses before app entry.
- Expanded focused Windows QA unit suite (nine test files including CPU profiling, heartbeat, admission, monitor and exit classification): **38 PASS, 0 FAIL, 0 SKIP** on Mac Node 26. `git diff --check` PASS.
- **No native Windows packed runtime probe or real PostgreSQL/Chromium run in this B1-64 wave.** This is a source-and-synthetic-hook qualification only.

## Next mandatory gates

1. On a resource-safe authorized Windows QA checkout with dependency-complete SHA256-owned runtime, run one bounded `--run-trace`, preserving exact fixture ownership and cleanup. Interpret load and evaluation markers together, without claiming a root cause from the last marker alone.
2. Fix only a positively identified issue; then rerun real Windows compiled HTTP/Better Auth/Chromium + 12 concurrent writes to one isolated PostgreSQL, and independent multi-suite no-orphan checks (#234/#237).
3. Qualify native Linux, installers, untrusted offline agent sandbox, privacy/security/licensing and NOTICE. No main merge, Actions, release, publishing, deployment, paid compute, or customer data.
