# B1-69 — Windows PostgreSQL template-cache fail-closed gate

Date: 2026-10-30. Parent: PRIVATE Draft PR #322 at `03fe9ccc292af405a0a31aa1f4c7bca84297f026`. This is a zero-cost, private, nonpublishing engineering change; no release qualification is implied.

## Why this change is necessary

Issue #234 reproduced native Windows `postgres.exe --forkchild=io_worker` orphans. Read-only review of the exact B1-68 source established that `stopOwnedWindowsEmbeddedPostgres` does not independently prove all owned workers exited. The template builder uses `instance.stop()`, `PG_VERSION`, and absence of `postmaster.pid` to admit cache publication. Reuse and age-based pruning likewise lack owned-worker process-tree proof. A missing PID file is not evidence that all children are gone.

## Minimal mitigation

- Until Windows native teardown can independently prove zero owned workers, always bypass template-cache creation, publication, reuse, and pruning on Windows, regardless of `PAPERCLIP_TEST_POSTGRES_TEMPLATE` (including explicit `1`). Use the existing fresh-cluster path instead.
- Preserve existing template directories untouched; do not remove old caches, retained fixtures, stale PID files, unknown processes, or user data.
- Preserve the existing `PAPERCLIP_TEST_POSTGRES_TEMPLATE=0` opt-out on Linux and macOS. Skip template-specific integration assertions on Windows while keeping the fresh-path test.
- This mitigation **does not fix** Windows embedded PostgreSQL child teardown, does not prove safe cleanup of fresh fixtures, and can increase Windows test runtime/disk consumption. Native resource admission remains mandatory.

## Objective evidence and limits

- Local isolated Linux Node 22.16.0 native TypeScript strip execution of the exact pure policy: **15 PASS, 0 FAIL**, covering five Windows settings, Linux and macOS defaults and opt-outs.
- Static exact-source integration assertions verified the policy import, invocation, and three Windows template-test skips plus Windows support-probe skip before commit.
- The complete Vitest suite, TypeScript semantic typecheck, native Windows PostgreSQL, Better Auth, HTTP, Chromium, and multi-suite orphan proof were **not run**. Desktop Commander reports **0% remaining monthly calls**; the authorized Windows device is online, Mac offline, and current disk/RAM/process state cannot be measured. No bypass of resource gates.

## Remaining acceptance gates

Implement bounded independent native Windows owned-process inspection with executable path, PID/parent/creation-time and explicit uninspectable outcomes; prove zero workers before fresh-fixture cleanup or template enablement. Run negative cases (missing PID + live worker; `pg_ctl` success + lingering worker; stale PID; ambiguous/foreign process) and multiple sequential real PostgreSQL suites with zero owned orphan processes and zero leftover owned scratch fixtures. Requalify packed Windows startup, real 18-stage Better Auth/HTTP, Chromium concurrency, Linux/Mac, installer, offline agent, security/privacy, licensing/NOTICE. **Release NO-GO.**

No main merge, GitHub Actions, publish/deploy/release/npm pack, paid compute/cloud/model, customer data, foreign process kill, or disk cleanup.
