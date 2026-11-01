# B1-166 — Owned Mac parallel PostgreSQL QA process groups on timeout

**PRIVATE / DRAFT / ZERO-COST / UNMERGED / RELEASE NO-GO — 2026-11-01 Asia/Riyadh**

Direct parent: private PR #422 exact head `da6ac46cb3a02e03fff1d5d31eaf7c9571010102`. Test-qualified proposed source SHA `9fbe0c00d59fb7caab64f1b420f849a4734e7f67`. The only source changes are Mac-specific private QA runner and its test; no production server, agent, database shutdown policy or UI changed.

## Root cause / narrow repair

`scripts/bostan-private-mac-parallel-postgres-authz.mjs` launches two parallel packed HTTP/BetterAuth/PostgreSQL worker shell scripts. Previously its bounded 120-second timeout and output-overflow handler invoked `child.kill('SIGTERM')` on the direct `bash` child only. Any inherited grandchildren (including local server or PostgreSQL from the owned QA worker) could survive that signal, leaving an unsafe orphaned QA process. The runner refused to mark incomplete receipts as success, but did not scope termination to the **owned worker group**.

On macOS in explicitly opted-in `--run` or `--run-with-browser` test mode, the QA runner now spawns each `bash` with `detached:true`, thereby allocating a new POSIX session/process group. It imports the repository's pre-existing `createOwnedNativeQaProcessGroup` / `terminateOwnedNativeQaProcessGroup` helpers and, on timeout or bounded-output overflow, sends SIGTERM **only** to the process group identified by that newly spawned child PID. It never signals a global process name or arbitrary PID. Spawn failure lacking a usable child PID falls back only to the child handle, not a group. `runWorker` validates the Mac platform and timeout bounds before launch. The original packed-runtime SHA ownership, source admission, output proof, CI privacy and release NO-GO checks are unchanged.

## Actual native macOS tests on exact Git source

Authorized macOS Darwin arm64 machine Node v26.0.0. Reused the already existing clean full private `Bostan-B142-qa` worktree with original detached HEAD `88e0274412c2e6cbadd07534960b20184907f291`. Fetched private branch and temporarily checked out exact test source commit `9fbe0c00d59fb7caab64f1b420f849a4734e7f67` (Git CLEAN), without cloning, installing dependencies, using cloud APIs or paid services.

Executed native Node tests from the actual checked-in source:

~~~sh
node --test --test-reporter=tap scripts/bostan-private-mac-parallel-postgres-authz.test.mjs scripts/bostan-disposable-native-process-group.test.mjs
~~~

**10/10 PASS; zero failed, skipped, cancelled; exit code 0; 554.73 ms total Node TAP duration.**

Tests include: no-arg plan with no secrets; strict environment scrub; exact authz/DB/teardown receipt parser; overlap refusal for sequential passes; memory admission parser; browser-vs-API proof separation; process-group opt-in guard and PID validation; actual detached synthetic child group SIGTERM without killing the calling process; and **new actual `runWorker` bounded-timeout integration**. That new test injects a single synthetic detached Node child which holds an interval (no PostgreSQL, external process or customer data), verifies `detached:true`, waits for the runner's short test-only 300ms timeout, confirms an unqualified timed-out receipt, and verifies the synthetic child PID is no longer running. Its `finally` may kill only the exact child it launched, if any. It does not launch the packed Bostan application or real DB.

After the suite, independent read-only Mac process checks found **zero matching private QA runner processes or worktree-owned PostgreSQL instances**, and Git was CLEAN. The existing Mac QA checkout was restored to its EXACT original detached SHA `88e0274412c2e6cbadd07534960b20184907f291` and verified CLEAN. No user files, global caches or unrelated processes removed.

## Boundaries / open release gates

This qualifies a specific **Mac QA runner SIGTERM timeout/overflow process-group safety improvement**, NOT the complete packed Mac parallel-PostgreSQL integration or native Windows forced-crash `io_worker` behavior. No real PostgreSQL process was forcibly terminated by this task. Windows issue #234 (adversarial forced-crash native PG/no-orphan evidence) remains OPEN. #237 (compiled Windows server and real Chromium/tenant/role journeys) remains OPEN. Root TypeScript7, full root Vitest, Linux unprivileged bwrap, installed cross-OS app, user consent/side-effects, tenant isolation and legal provenance remain unqualified.

Keep private DRAFT unmerged; do not release, publish, deploy, enable Actions, use paid cloud/model providers, manipulate customer data or kill unowned process trees.