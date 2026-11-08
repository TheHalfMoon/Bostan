# B1-167 — Mac owned QA SIGTERM-ignoring worker escalation

Date: 2026-11-01 (Asia/Riyadh)  
Repository: private `TheHalfMoon/Bostan`  
Parent: Draft PR #423, exact head `c2cd12698c51c2b08dd6c04a9c7aa00888093afd`  
Status: private Draft only, unmerged; release **NO-GO**.

## Source-native RED finding

At the exact parent source, on the authorized macOS arm64 device (Node v26.0.0), an **explicitly created disposable detached synthetic Node QA child** installed a SIGTERM handler that intentionally ignored the signal and kept its stdio open. Calling the real checked-in `runWorker()` with `timeoutMs: 300` sent SIGTERM only once and its Promise was **still pending after 1,500 ms**. This is an actual QA runner hang, not a hypothetical source-equivalent parser. The harness then signaled **only that known synthetic child process group** with SIGKILL, awaited its exit, and restored the existing Mac B142 checkout to its original detached SHA. No PostgreSQL, HTTP server, browser or customer data was launched.

RED receipt: `BOSTAN_B167_PARENT_TIMEOUT_REPRO=still_pending_after_1500ms`.

## Narrow repair

`scripts/bostan-private-mac-parallel-postgres-authz.mjs` now schedules a one-second escalation after an existing timeout/output-overflow SIGTERM. SIGKILL is addressed **only** to the expressly spawned detached worker group, and **only while the original direct child is still alive** (`exitCode===null` and `signalCode===null`). The escalation timer is cancelled on `close`. No global process enumeration, PostgreSQL service stop, PID discovery, production app mutation or foreign-process termination was introduced. This preserves the ordinary graceful path.

The guard intentionally does **not** signal a potentially recycled group ID after its original leader has exited. Therefore this patch does not establish cleanup of every possible descendant that leaves the original group or survives after the group leader exits.

## Exact-source native GREEN

Source and tests at commit `681194315cadb15bd188bc5407404ce7ce9e60d7` (before this evidence-only commit) were fetched and checked out temporarily on the authorized Mac B142 full private QA checkout. Command:

```sh
node --test --test-reporter=tap \
  scripts/bostan-private-mac-parallel-postgres-authz.test.mjs \
  scripts/bostan-disposable-native-process-group.test.mjs
```

Result: **13/13 PASS, 0 failed, 0 skipped, process exit 0**, 3,046.88 ms reported by Node TAP. Two new actual synthetic-child tests prove that a SIGTERM-ignoring worker is terminated after the 300 ms timeout or the 512 KiB stdout overflow. They assert the child PID no longer exists and the parent survives. Existing 11 tests continue passing. No real PostgreSQL cluster or packed server was run.

Independent after-run read-only verification: Mac B142 checkout restored to its exact original detached SHA `88e0274412c2e6cbadd07534960b20184907f291`, Git working tree clean, zero matching synthetic QA worker processes. Mac free memory was 44% at the final check. No new clones or dependency installs.

## Remaining qualification boundaries

This only qualifies the **Mac test-only QA runner** for the synthetic leader-ignores-SIGTERM timeout/overflow cases. It does not qualify actual packed concurrent PostgreSQL/Better Auth/Chromium runs, descendant escape/group-leader-exit behavior, Windows forced-crash io_worker issue #234, compiled Windows runtime/browser issue #237, full TypeScript7/root tests, real unprivileged Linux bwrap, installed three-OS journeys, agent consent, tenant privacy or legal provenance. Release remains **NO-GO**. No merge, Actions, deployment, publication, paid provider or customer data.
