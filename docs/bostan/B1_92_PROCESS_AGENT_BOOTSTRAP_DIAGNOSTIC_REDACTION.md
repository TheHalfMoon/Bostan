# B1-92 — Redact process-agent setup and pre-spawn bootstrap diagnostics

Date: 2026-10-31. STRICTLY PRIVATE / ZERO COST / NONPUBLISHING. Stacked exact parent Draft #346 at `8fdb2d077c64778316f067e7cd6c6a33cf1523e0`.

## Confirmed production diagnostic leakage

The existing process adapter setup check serialized raw configured commands, working directories, and arbitrary OS/path resolution exception messages and `detail` fields into the returned `AdapterEnvironmentTestResult`. User-controlled command paths, signed strings, account/home paths and secrets could be surfaced through persistent setup diagnostics.

A separate pre-spawn bootstrap failure returned `error.message` or `String(error)` as the heartbeat execution result. A failure before process spawn, such as metadata persistence error, could include credentials, private paths, and command arguments in the stored error message.

Added three synthetic regression cases **BEFORE implementation**, then ran exact source parent: **3 RED**. The fixtures used only synthetic markers such as `PRIVATE_COMMAND_TOKEN`, `PRIVATE_CWD_TOKEN`, `PRIVATE_AUTH`, plus a test-local `onMeta` exception that occurs before `runChildProcess`. No external provider, database, credentials or real user data.

## Minimal code change

- `server/src/adapters/process/test.ts`: return **fixed, semantic** messages for command presence/resolvability and working-directory validation. No configured command or cwd, no raw exception and no arbitrary diagnostic `detail`. Underlying `ensureAbsoluteDirectory` and `ensureCommandResolvable` still run, with their real verdict preserved through check codes/levels.
- `server/src/adapters/process/execute.ts`: only when a failure happens **before process spawn**, emit `Process adapter bootstrap failed before process start` without invoking unknown `error.toString()`, copying external exception text or preserving a cause. Preserve `exitCode:1`, `timedOut:false`, and `executionRecovery:{kind:'bootstrap',providerWorkStarted:false}`. If a process was actually spawned, the existing accounting/recovery behavior is **not changed**.
- The real process command, arguments, cwd, inherited-env sanitization, `onMeta` payload, child execution policy, timeout, teardown and log streaming are deliberately unchanged. This does **not** claim complete secrecy of operator-visible metadata or stdout/stderr; those paths require separate review.

## Executed tests and limitations

On authorized Mac Node 26 and existing pinned Vitest 5 with one worker and no dependency install:
- Focused **3/3 PASS** after code fix, all three previously RED.
- Targeted TypeScript 7 `--noEmit --strict` of the modified process source files: **PASS**.
- Wider integration attempt across accounting + registry + routes + focused tests: **70 PASS / 27 FAIL**. Those 27 unrelated vendor-adapter tests failed with `Cannot find package '@bostan/adapter-utils/server-utils'` in the QA package resolution environment, not a proven process-bootstrap behavior regression; **do not mark the broad suite GREEN**.
- Scoped accounting regression `server/src/__tests__/adapter-cost-failure-paths.test.ts -t "process adapter bootstrap accounting proof"`: initial attempt **3 PASS / 1 FAIL** because cold module processing exceeded **the test's original 15-second timeout**. Repeated the **exact same four cases** with `--testTimeout=60000` (test runner only, not app production timeout): **4/4 PASS**, 27 other accounting cases explicitly skipped by name filter. Correctly proves no provider work before spawn and does not invent bootstrap proof when the process already spawned.
- `git diff --check`: PASS. Mac source-only tests, no production DB, real agent model, installed Windows build, remote service or publication.

## Outstanding release blockers

This closes only the **identified process-adapter diagnostic and bootstrap-result leakage**. The independently observable `onMeta` command-argument payload, child stdout/stderr logging, untrusted agent command sandbox/effects consent, native Windows packed app startup/PG/Chrome, native Linux runtime/installers, complete security/privacy and licensing/NOTICE/provenance audits remain release **NO-GO**. Repo PRIVATE, stacked PR DRAFT; no protected-main merge, GitHub Actions, release, deployment, npm publishing, paid compute or customer data.

## Additional route and registry compatibility checks

After the implementation at `fd4ff2838c2c57535750ac58df2a1fc558b6dac2`, ran a second, fully successful, independent native Mac Node26 / Vitest5 suite with a 1280MiB heap and one worker: `adapter-registry.test.ts` (33 PASS), `adapter-routes.test.ts` (30 PASS), `process/execute.test.ts` (1 PASS) and `process/test.test.ts` (2 PASS): **66/66 PASS**, no skips or failures. This strengthens the negative/positive evidence for adapter discovery, route integration and process setup privacy. It does NOT resolve the separate vendor adapter-utils resolution failure (27 other broad tests) and is not a Windows/Linux live installed-binary qualification.
