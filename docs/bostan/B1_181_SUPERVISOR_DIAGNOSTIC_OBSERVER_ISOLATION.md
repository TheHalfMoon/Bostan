# B1-181 — PostgreSQL supervisor diagnostic observer isolation

Status: **PRIVATE DRAFT / UNMERGED / RELEASE NO-GO**. Direct parent: B1-180 PR #438, exact head `52d75e945f1493632ccc1f73d8e41ec59904329a`.

## Verified defect and bounded source repair

In `server/src/embedded-postgres-supervisor.ts`, callbacks `onRecoveryExhausted` and `onRestartAttemptFailed` are diagnostic observers, not native PostgreSQL lifecycle authority. Before this patch:

- If a replacement `start()` rejected and its owned `stop()` also rejected, a throwing `onRecoveryExhausted` interrupted the fail-closed branch and replaced the meaningful unverified-stop failure with an observer error. This could escape the recovery routine without preserving the intended lifecycle outcome.
- A throwing `onRestartAttemptFailed` aborted bounded retries even when the failed replacement had been verified stopped.
- A throwing final exhaustion observer rejected `waitForRecovery()` with a diagnostic error instead of the bounded recovery result.

The repair catches only **synchronous diagnostic callback exceptions**. It does not swallow native `start()`/`stop()` failures, relax retry limits, authorize extra PostgreSQL processes, or alter production DB configuration. The existing unverified-stop marker still rejects `waitForRecovery()` and `shutdown()`. The same guarded exhaustion notification is used for a missing child process monitor.

## Native test-first evidence

- Test-only commit `de89718fc072124c86e359c5d7f4bea2c235157e` on **macOS arm64 / Node 26 / Vitest 5.0.3**, exact checked-in suite: **10 PASS / 3 RED**, exit 1. The three new regressions independently reproduced the diagnostic-observer failures.
- Fixed source+test commit `29ead15f62907e6983211b38f801f2c7aa03efb5` on **macOS arm64 / Node 26 / Vitest 5.0.3**: **13/13 PASS**, exit 0, single fork worker.
- Same exact fixed commit on **Windows 11 / Node 24.19 / Vitest 5.0.3**: **13/13 PASS**, exit 0, single fork worker. Read-only preflight: ~5.73 GiB free RAM, no native `postgres.exe`.
- Windows TypeScript **7.0.2**, exact fixed source: targeted `tsc --ignoreConfig --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --types node --skipLibCheck src/embedded-postgres-supervisor.ts` **exit 0**. The first invocation without `--ignoreConfig` returned TS5112 (CLI invocation error), corrected without source changes. This is **not** full root/server TypeScript qualification.

Both pre-existing QA checkouts were restored to original detached clean commits: Mac B142 `88e0274412c2e6cbadd07534960b20184907f291`; Windows B111 `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`. No PostgreSQL, network service, customer data, new clone, paid dependency, or foreign process termination was used in these synthetic supervisor tests.

## Remaining release blockers

**NO-GO**. Synthetic `EventEmitter` and `stop()` mocks do not qualify Windows real forced-crash `io_worker` zero-orphan behavior (#234), freshly compiled SHA-owned authenticated Windows HTTP/Chromium (#237), real Linux rootless Bubblewrap, full TypeScript/Vitest, installed cross-platform journeys, agent consent, tenant privacy, or legal provenance. No main merge, Actions, release, publication, or deployment.
