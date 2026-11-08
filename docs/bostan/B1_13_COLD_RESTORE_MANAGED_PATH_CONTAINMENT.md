# B1-13 — Fail closed on noncanonical managed paths during cold restore

Date: 2026-10-29. Bostan **PRIVATE**, zero-cost, nonpublishing. Stack on B1-12 Draft PR #264 at base commit `5634ab63dfb41ed595dda4e7084bc8e9c80d9948`. No protected-main merge or deploy.

## Actual issue reproduced on native Windows

In `scripts/bostan-cold-snapshot.mjs`, `rebaseManagedConfig` accepted any absolute managed path whose raw string began with the original source application directory. On Windows a value such as `<sourceApp>\\..\\..\\..\\outside\\master.key` passed the lexical prefix check but resolves **outside** the isolated source app and, when rebased, outside the new target app. The affected launcher-owned fields are `database.backup.dir`, `logging.logDir`, `storage.localDisk.baseDir`, and `secrets.localEncrypted.keyFilePath`. This could cause the restored configuration to reference locations outside its intended new Bostan home if supplied with a noncanonical saved config. This is not evidence that such paths were exploited, nor evidence that the restore function itself read those external files.

A new Windows `node:test` real fixture saved an owned cold snapshot containing the crafted `secrets.localEncrypted.keyFilePath`. **Before repair**, the exact regression failed as expected: `Missing expected exception`, because the restore unexpectedly returned successfully. The test uses a disposable synthetic HOME, fake offline pg_ctl status, and does not touch a real database or user profile.

## Narrow repair

- Require `path.normalize(value) === value` in addition to the existing absolute-path and source-app lexical containment check before rebasing each managed field. This rejects embedded `..` and `.` components and noncanonical separator aliases rather than rewriting their raw suffix into a new HOME.
- Retain existing refusal of external managed paths, and continue to copy only first-party launcher-owned settings. Do not touch arbitrary user payload/model references, browser state, or persistence identifiers.
- Added an exact red-before-green regression and a four-field table-driven test requiring restore to throw for every managed field and delete only its newly created destination HOME. The original source HOME and cold snapshot are preserved for investigation.

## Actually executed

Native Windows 11, Node.js **24.19.0**, exact previously verified private isolated `D:\\Bostan-B111-qa` branch. `node --check` on source and test: PASS. Targeted crafted-path regression **FAIL before patch** (confirmed unsafe acceptance). After repair, `node --test --test-reporter=tap --test-concurrency=1` on:
- `scripts/bostan-cold-snapshot.test.mjs`
- `scripts/bostan-runtime-recovery.test.mjs`
- `scripts/bostan-local-runtime.test.mjs`
- `cli/src/__tests__/bostan-preview.test.mjs`

Result: **52 tests, 46 passed, 0 failed, 6 skipped**, 7.78s. The skipped cases are explicitly skipped in existing runtime-recovery tests; they were not executed. Previous baseline of the three Bostan snapshot/recovery/runtime files was 44 tests (38 pass, 6 skip).

An additional complete **17-file** native Windows dependency-free replay combined all 13 `scripts/bostan-private-windows-*.test.mjs` files with these four snapshot/recovery/runtime/CLI suites: **154 tests, 147 passed, 0 failed, 7 skipped**, 13.79s. All tests ran against the same patched exact checkout. These suites do not start real PostgreSQL, run full source-server HTTP/Chromium, or verify installable builds. Cross-platform replay of B1-13 is pending.

## Remaining qualifications

Bostan release is still **NO-GO**. Native Windows real embedded PostgreSQL teardown/orphan issue #234, full 18-stage authenticated source server/Chromium issue #237, Mac full product QA, free local agent task, reproducible source/installers, recovery and independent security/licensing checks remain open. Windows RAM previously measured below the >=2 GiB admission floor and dependencies were absent from the fresh private QA checkout, so heavy native tests were intentionally not attempted. Never bypass resource admission, interfere with other processes, activate GitHub Actions, merge to protected main, release, publish, or use real customer data / paid services.
