# B1-88 — Fail closed on foreign postmaster PID before Windows pg_ctl

Date: 2026-10-31. **PRIVATE · ZERO COST · NONPUBLISHING · STACKED DRAFT ONLY.** Parent B1-87 Draft #342 at `f288fbfbc1957e1147c9ad6c122faca9a77f181d`. No production server, deployment, release or Actions changes.

## Defect and bounded repair

The previous Windows test-only PostgreSQL teardown validated `postmaster.pid` line 1 as a decimal PID and line 2 as the owned data directory, but it did **not** verify that the PID actually referred to a process running the pinned `postgres.exe` before invoking `pg_ctl stop`. A forged or stale marker with an owned path and foreign PID could reach the shutdown runner. A new synthetic regression on the unmodified B1-87 parent produced **48 PASS, 1 FAIL, 1 SKIP**. The test saw a post-shutdown process-wait error rather than a pre-shutdown identity rejection; the fake shutdown runner had already been invoked. No actual process was signaled.

The fix reuses one shared, strict Windows CIM snapshot validator (valid identity fields, unique PIDs, normalized executable paths). Before any `pg_ctl` call, it requires a process with **the exact PID from the owned marker and the exact pinned `postgres.exe` path**. Missing, foreign, duplicate or ambiguous process identities fail closed. Because inspection is asynchronous, the bounded PID marker is revalidated and its pathname file identity rechecked after the scan, before shutdown. The original two-clean-snapshot post-shutdown quiescence proof, no-foreign-process-termination policy, and owned fixture retention are unchanged.

The new tests cover foreign PID, same PID at foreign executable, duplicate/ambiguous CIM rows and a PID marker modified during asynchronous inspection. Existing successful synthetic shutdown tests now explicitly supply an owned postmaster row before their post-stop clean scans. No PID, path, credentials or command line is logged.

## Objective evidence

- Authorized Mac, Node 26, Vitest 5, one worker, 1024 MiB heap: **51 PASS / 0 FAIL / 1 SKIP** (52 tests) after fix.
- Targeted strict TypeScript: `tsc --noEmit -p packages/db/tsconfig.json` **EXIT 0**.
- `git diff --check`: **PASS**.
- Native Windows **not run**: connected Windows Desktop Commander device `62835bd9-9ffe-4bd5-9010-6ac23b2d7223` does not match explicitly authorized Windows device `6641fb27-1a94-40b7-a76d-06e5e61a49af`. No Windows commands, real PostgreSQL stop, heavy build, packed runtime, Chromium or customer data.
- Mac's preexisting Homebrew PostgreSQL processes were not stopped or modified. Only isolated synthetic test fixtures were created and removed by their own harness.

## Limitations and release gate

A CIM snapshot and filesystem preflight are **not atomic OS-level ownership proof**: PID reuse, snapshot races and native Windows path spelling still require real-device qualification. This fix is for a test-only teardown helper, not production runtime. It does not close #234 real parallel multi-suite PostgreSQL no-orphan, #237 Windows packed static-import/18-stage Better Auth HTTP readiness, B1-60 concurrent-write RED, offline agent, Linux, installers, security/privacy or copy-first licenses/NOTICE.

**Release NO-GO.** Preserve PRIVATE repository, unchanged `main`, disabled Actions and stacked Draft PRs only. No merge, publish, deploy, release, npm pack, paid compute/models/cloud, foreign process kill, old retained-fixture deletion or unrelated disk cleanup.
