# B1-176 — POSIX PostgreSQL bounded stop timeout must fail closed

Date: 2026-11-01 Asia/Riyadh. PRIVATE / ZERO COST / DRAFT / UNMERGED / RELEASE NO-GO.

## Defect

The prior private stacked Draft PR #433 at exact source HEAD `9d9415f25e8c5b3e48d6fdd12a80c1af635cec86` had already fixed deleting a disposable cluster after `stop()` rejects. But the POSIX `stopEmbeddedPostgresBounded()` timeout path still resolved its own Promise after 5 seconds without proving that the process or its descendants stopped. A caller awaiting this helper could consequently report successful shutdown despite a pending `instance.stop()`; the cleanup callback remained deferred but the success receipt was incorrect.

## Narrow source fix

The POSIX 5-second bound now **rejects** with `POSIX embedded PostgreSQL stop timeout; retaining fixture` rather than resolving. It does **not** cancel the underlying stop: a later *successful* stop may still run the already-registered cleanup callback once, while a late rejected stop never authorizes cleanup. The existing Windows separate 50-second stop branch and pinned native ownership logic are unchanged. A third timeout parameter defaults to the exact prior 5,000 ms and is used only by a new test export for fast deterministic deferred-stop test cases.

## Native test-first evidence and scope

Test environment: connected Mac Apple Silicon, Node 26, Vitest 5, private test-only 21 MB B201 source copy of an existing partial checkout with preinstalled dependency links. Before testing, both source and test files were replaced by their **exact #433 GitHub source blobs**, independently verified via native `git hash-object`. No dependency downloads or customer data.

- Original #433 source with test-only injection but *unchanged timeout behavior*: **2/2 new regression tests RED**, Vitest exit 1. Both observed a resolved stop when the test demanded timeout rejection.
- Repaired source: two deferred synthetic cases verify (1) timeout reject with *no cleanup while stop is pending*, then cleanup once after explicit fulfillment, and (2) timeout reject with *no cleanup* after subsequent stop rejection. **2/2 PASS**.
- Included the previous #432 synthetic regression that preserves a cluster on immediate rejected stop: final focused **3/3 PASS**, 15 unrelated tests skipped by name filter, **exit 0**.
- Native Mac TypeScript 7 targeted `tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2023 --module NodeNext --moduleResolution NodeNext --types node src/test-embedded-postgres.ts`: **exit 0**. This is NOT full root/server TS7.
- Final source blob `ba41ccb0d898ec890ad893ba97a4845409298d48`, test blob `31fdf37e878c3bc935c1168684e418b305b1dcb2`, SHA matching local Mac source. No native Windows full test run or Linux run is claimed.

## Additional genuine native Mac PostgreSQL smoke — bounded scope

After synthetic RED/GREEN, ran one real embedded PostgreSQL migration test (`src/session-goal-migration.test.ts`) on the connected Mac against the patched `test-embedded-postgres.ts` and isolated 0700 owner-created `Bostan-B201-temp` directory, with `PAPERCLIP_TEST_POSTGRES_TEMPLATE=0`, Vitest single fork, 90s test/hook bound, and no managed Cloud configuration.

- First run with original older checkout test source: **1/1 PASS, EXIT 0**, duration 6.89s; independent QA-root-process scan 0 before/0 after; scratch directory empty after.
- Retrieved `session-goal-migration.test.ts` directly from current private #434 GitHub branch and replaced the older test file; native `git hash-object` **627cea565fd5b8f558079e2aa3218aae93f7197e** matches GitHub blob exactly.
- Repeated with this current exact test source: genuine PostgreSQL **1/1 PASS, EXIT 0**, Vitest duration **68.82s** (heavy concurrent user-system activity affected transform/import time). Native scan: **0 owned PG processes before and after**, scratch root **0 entries** afterward. No force kill, no shared service changed.
- Important qualification boundary: the full tiny QA source copy was NOT a clean full checkout of #434; only the modified source/test files and this migration test were pinned to their exact GitHub blobs. This is a **narrow real native Mac database smoke**, NOT complete latest compiled repo, installed app, multi-suite stress, or forced-crash zero-orphan proof.

## Release barriers

This is a test-support lifecycle safety fix only. It is NOT real PostgreSQL forced-crash worker quiescence (#234), freshly SHA-owned Windows compiled server/Better Auth/Chromium (#237), installed product qualification, nor proof of a native macOS/Linux delayed stop under actual load. Previous full `test-embedded-postgres.test.ts` Mac source-copy run on #432 had two unrelated template-mode expectation failures (first reproduced on the unchanged older source); those are **not claimed fixed** and require full current-head environment proof.

All work remains PRIVATE, stacked DRAFT, not merged; RELEASE NO-GO. Never run GitHub Actions, publish/deploy/release, pay providers, use user/customer data, kill unrelated processes, or delete retained/foreign fixtures.
