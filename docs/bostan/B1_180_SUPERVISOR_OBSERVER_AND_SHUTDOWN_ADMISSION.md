# B1-180 — PostgreSQL supervisor observer and shutdown admission safety

Date: 2026-11-01 Asia/Riyadh. PRIVATE / zero-cost / Draft stacked PR only. **Release NO-GO.**

## Actual production source findings

On exact parent Draft #437 HEAD `0dddc4519e0beaa0c342d7131eb8fb6c634566c2`, `server/src/embedded-postgres-supervisor.ts` had three recovery hazards:

1. An optional `onUnexpectedExit` callback exception escaped the EventEmitter exit handler **before** `recoveryPromise = recover()`, preventing all recovery.
2. An optional `onRestarted` callback exception was caught as a restart failure **after** the new PostgreSQL instance was already started and made active. The next attempt could create another live native cluster without stopping the first.
3. If shutdown began while the asynchronous `beforeRestart` callback was pending, the recovery loop continued to create and start a new PostgreSQL instance after shutdown admission. Shutdown later stopped it, but the unnecessary start could have side effects or fail.

## Bounded source repair

- Isolate exceptions from the two optional *diagnostic* callbacks, without treating them as native PostgreSQL start/stop failures or retrying a successfully started cluster.
- Recheck `shuttingDown` immediately after the awaited `beforeRestart` hook, before creating a replacement.
- Preserve existing native stop, failed-start cleanup, retry bounds, and shared shutdownPromise logic. No global process signaling, data deletion, or application HTTP changes.

## Test-first native evidence

New exact checked-in `server/src/__tests__/embedded-postgres-supervisor-observer.test.ts` uses synthetic EventEmitter and mock native instances; it does not spawn PostgreSQL.

- **RED**, native Apple Silicon macOS Node v26.0.0 / Vitest v5.0.3: exact test-only commit `5050d4f27f99161a37b58b1cbad388f7d4e1d715`, **3/3 new tests failed** on unchanged parent production source, independently showing all three behaviors.
- **GREEN**, exact source+test commit `6d0181ea2a6ec1b10ae53b5194104f49123cad1a`: macOS native Vitest 5, single fork worker, new observer suite **3/3** and existing supervisor suite **10/10**, total **13/13 PASS**, exit 0. Exact source Git blob `d66834c2bfa09712d545e89aedc6508b7cf22b82` verified by `git hash-object`.
- **GREEN**, Windows 11 native Node v24.19.0 / Vitest v5.0.3: same exact source+test commit, same two suites **13/13 PASS**, exit 0, one fork worker. No PostgreSQL started; independent post-run `postgres.exe` count **0**.
- macOS targeted TypeScript v7.0.2 strict `--noEmit --ignoreConfig --module nodenext --moduleResolution nodenext --target es2022 --types node` for the actual supervisor source **exit 0**. An initial `tsgo` binary path and then a missing `--ignoreConfig` flag caused command-level refusals; these are not TypeScript source failures. Full root/server TS7 remains unqualified.
- Both pre-existing QA checkouts were restored **exactly clean** to their original detached SHAs: Mac `88e0274412c2e6cbadd07534960b20184907f291`, Windows `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`. No new clone, dependency installation, persistent local source copy, paid provider, foreign process termination, or customer data.

## Remaining release blockers

This repair is synthetic supervisor qualification, **not** a genuine PostgreSQL forced-crash/worker-exit proof. Issue #234 Windows native `io_worker` orphan stress, #237 freshly compiled SHA-owned Windows authenticated HTTP/Chromium, full root TypeScript/Vitest, native Linux rootless bwrap, installed cross-OS journeys, tenant/consent/privacy/security and legal provenance all remain **OPEN / NO-GO**. No main merge, Actions, publication, deployment or release.
