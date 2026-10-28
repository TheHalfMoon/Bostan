# B1-15 — Fail closed and redact Bostan managed Windows backend startup errors

Date: 2026-10-29. **PRIVATE**, zero-cost, Draft-only, nonpublishing. Stacked on exact B1-14 PR #266 head `4b95f8097ce09bc6f4b90f472d980260691631a6`.

## Real startup failure reproduced on native Windows

The local source runtime's Windows disposable QA child is `scripts/bostan-managed-server-child.mjs`. Its top-level `main().catch` originally printed `error.message` unfiltered and set only `process.exitCode = 1`. Unlike a normal script, this child retains a live parent IPC listener; startup code may also leave an open resource. Thus setting `exitCode` does not guarantee the parent ever receives the required process exit event, and its log can reveal connection strings, provider keys and private filesystem references.

Before repair, a **genuine separate Node.js 24.19.0 process** executed a copied managed child entrypoint in a disposable synthetic directory with a fake `server/src/index.ts`. The fake `startServer` deliberately kept a timer active and threw `Error("postgres://bostan:BOSTAN_SYNTHETIC_DATABASE_PASSWORD_NEVER_LOG_9173@127.0.0.1:5432/bostan")`. No real Bostan server, database or customer data was used.

- First red run confirmed the failed child did **not terminate** when the IPC listener remained open; a 15-second test deadline fired. The exact test-owned leftover child was separately identified by parent PID and disposable source path and stopped; no other process was touched.
- The bounded follow-up red run independently confirmed the complete synthetic password and PostgreSQL URL were **printed to stderr**. It required a 5-second watchdog to terminate the otherwise lingering child.
- Both conditions are concretely reproducible, not hypothetical generic security advice.

## Minimal production-path repair

In `scripts/bostan-managed-server-child.mjs`, the top-level failure handler now emits only an allowlisted `Error` / `TypeError` / `SyntaxError` / `ReferenceError` / `RangeError` category (or `other`). It never interpolates the exception message, stack, custom name or environment into the local QA log. After the short diagnostic is written, it explicitly terminates **nonzero** via the stderr-write completion callback. This handles the open IPC listener and deliberately lingering failed-startup resources. It does not affect the successful startup / graceful IPC stop pathway.

A new standalone offline process regression with real Windows IPC, failed server import/start, an artificial open timer, a synthetic credential-bearing error, bounded watchdog and nonzero-exit assertions proves that the child does not log the credential and exits by itself without a parent disconnect.

## Executed native evidence

- Host: authorized Windows 11, Node.js 24.19.0; isolated private `D:\\Bostan-B111-qa`, no dependencies installed or production services started.
- Before patch: red isolated child regression showed secret in `stderr` and no spontaneous process exit.
- After patch: `node --check` PASS; `node --test --test-reporter=tap scripts/bostan-managed-server-child.test.mjs` **8 PASS / 0 FAIL** including real IPC success and failed-startup regressions.
- Broader **17-file** dependency-free Windows replay (13 `scripts/bostan-private-windows-*.test.mjs` plus the managed child, cold snapshot, local runtime, recovery): **156 tests; 149 PASS, 0 FAIL, 7 SKIP** (36.96 seconds).
- Skipped cases remain explicitly unexecuted. No macOS replay of this wave yet. The heavy embedded PostgreSQL, live Better Auth HTTP, full source startup with real dependencies, Chromium browser and an actual model-enabled agent were **not executed** in this wave because free Windows physical RAM measured approximately **1.25 GiB**, below the existing >=2 GiB heavy-test gate.

## Remaining gates

This repairs a genuine native Windows startup failure **privacy and lifecycle** defect but does not prove that the actual Bostan server can start with all dependencies. GitHub issue #237 stays OPEN pending real authenticated/private source HTTP, synthetic auth/bootstrap, Chromium, and root-cause qualification of original health failures. Issue #234 stays OPEN until actual orphaned PostgreSQL worker teardown reaches zero after a genuine test. Full product E2E, local zero-cost agent, packaging, cross-platform QA and privacy/licensing review remain release gates. No protected-main merge, publish/release/deploy, paid providers, customer data, or unrelated user-process changes. Release **NO-GO**.
