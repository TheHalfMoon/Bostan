# B1-182 — Fail-closed PostgreSQL recovery monitor admission

Date: 2026-11-01 (Asia/Riyadh). Private engineering only. Release remains **NO-GO**.

## Exact stack and change

- Parent: private open Draft PR #439, branch `work/b1-181-supervisor-diagnostic-observer-fail-closed`, exact parent SHA `769beb3084cb821fb1618200a718647a7f0b80cb`.
- Test-first commit: `83c5895e30132a92c1b8a8f22a8d96a11c574eea`.
- Source repair commit: `0a847f7bfa9a452cfa4b7504df275dcf60b771d1`.
- Source: `server/src/embedded-postgres-supervisor.ts`; tests: `server/src/__tests__/embedded-postgres-supervisor.test.ts`.

## Actual defect and repair

A replacement `start()` could resolve successfully without exposing a child `process`. The old `monitor(replacement)` only reported a diagnostic error, then recovery promoted the replacement to `activeInstance` and reported success even though no exit listener existed. Similarly, a real Node child may already have `exitCode` or `signalCode` set when `start()` resolves, with its exit event already missed. Both paths could silently leave an unmonitored or dead replacement.

The new admission validates the child monitor, checks the optional native `exitCode` / `signalCode` both before and after listener registration, and registers the monitor **before** promoting the replacement. On failure it awaits `stop()` of **only the attempted replacement** before a bounded retry. If native stop rejects, it records the unsafe state, refuses another replacement, and propagates the refusal to `waitForRecovery()` and `shutdown()`. The existing initial-instance behavior, successful recovery, diagnostics, and shutdown sharing remain unchanged.

## Native test-first evidence

- **Mac Apple Silicon, Node 26, Vitest 5.0.3**, authorized existing clean B142 checkout: at exact test-only commit, `vitest run src/__tests__/embedded-postgres-supervisor.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1` produced **13 PASS / 3 expected RED**, exit 1. The three failures reproduced missing stop on unmonitorable replacement, false recovery success after stop refusal, and adoption of an already-exited child.
- Same Mac, exact repaired source commit: **16/16 PASS, 0 failed, exit 0** with the same single-worker Vitest command. Targeted **TypeScript 7 strict noEmit exit 0** using `--ignoreConfig --strict --skipLibCheck --types node --target es2022 --module nodenext --moduleResolution nodenext` on the source file. An initial targeted invocation omitted `--types node` and failed with missing `NodeJS` namespace; the corrected explicit Node types invocation passed.
- **Windows 11, Node 24.19.0, Vitest 5.0.3**, authorized existing clean B111 checkout, exact repaired source commit: **16/16 PASS, 0 failed, exit 0** with the same bounded single-worker suite. Pre-run RAM ~5.68 GiB free and native `postgres.exe` count zero.
- Both existing QA checkouts restored to their exact original detached clean SHAs: Mac `88e0274412c2e6cbadd07534960b20184907f291`; Windows `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`. No new clones, dependency downloads, real PostgreSQL, customer data, Actions, deployments, releases, or unrelated process/file deletion.

## Bounds and outstanding gates

These are **synthetic lifecycle tests using EventEmitter / mocked native start and stop**, not a real PostgreSQL force-crash test. Child exit-state admission depends on the actual child exposing Node-compatible `exitCode` or `signalCode`; absence of those properties alone cannot prove liveness. Windows #234 genuine repeated forced-crash io_worker zero-orphan proof and #237 fresh SHA-owned compiled HTTP/Chromium roles/tenant acceptance remain open. So do native Linux unprivileged bwrap, full root/server TypeScript and Vitest, installed cross-OS journeys, agent consent/side effects, tenant isolation/privacy and legal provenance. **No release qualification is claimed.**
