# B1-173 — POSIX embedded PostgreSQL rejected-stop fixture preservation

Date: 2026-11-01 (Asia/Riyadh). PRIVATE / DRAFT / UNMERGED / ZERO COST / RELEASE NO-GO.

## Source finding and narrowly scoped fix

The test-only `stopEmbeddedPostgresBounded()` branch for macOS/Linux previously called `instance.stop().catch(() => {}).finally(cleanupFn)`. A rejected stop does not prove that the PostgreSQL server or its descendant workers have exited, but this path recursively removed the disposable cluster anyway. The fix calls the cleanup callback only after the stop promise fulfills; a rejected stop raises `Embedded PostgreSQL stop unverified; retaining fixture` and aborts the current startup retry. The Windows-owned process inspection and stop logic are unchanged. The existing POSIX five-second *pending* stop timeout/deferred-cleanup behavior is unchanged and does **not** prove quiescence.

## Test-first evidence

On the authorized Mac (Node 26, Vitest 5), in a separate source-copy QA workspace `Bostan-B199-qa` with reused local dependencies and a fake constructor (NO real PostgreSQL involved):

- **RED, before source patch:** the new `retains a disposable cluster if a failed start cannot be stopped` regression failed, as the old code swallowed the synthetic shutdown error, deleted the fixture and continued to five startup attempts.
- **GREEN, after source patch:** the same focused test passed **1/1**, zero fails, exit 0. The test asserts exactly one attempted cluster and that its owned scratch directory remains present until the test's own guarded finally cleanup.
- **Broader provisional run:** `test-embedded-postgres.test.ts` had **14 passed / 2 failed**; both failed expectations concerned the template-cache start mode being `fresh` rather than `template` in the Mac source-copy/dependency-reuse environment. These failures are **not** green qualification and are not claimed resolved by this fix. Additional baseline comparison is required before attributing them.

The Mac checkout is a source copy of an older verified branch for isolated red/green reproducibility, NOT a complete clean latest stacked branch or native Windows cross-platform qualification. The GitHub source/test changes are stacked on private Draft PR #429 at exact head `46bded5d57974ffe471c317781d77c28d8d9e1a0`.

## Remaining release gates

Windows forced-crash `io_worker` process cleanup #234 remains OPEN. Actual compiled server + Better Auth + authenticated Chromium #237 remains OPEN. Root TypeScript 7, Linux Bubblewrap, installed app qualification, consent/tenant restrictions, legal provenance remain unqualified. Do not merge into main, enable Actions, publish/deploy/release, call paid services, use user data or delete retained/foreign fixtures.
