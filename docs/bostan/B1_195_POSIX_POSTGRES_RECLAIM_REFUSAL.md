# B1-195 — POSIX PostgreSQL scratch reclaim refusal

**Private Draft / unmerged / release NO-GO.** Direct parent: B1-194 PR #451, exact starting HEAD `8ef6ade7630122583e04c0474c11d8cadf7c91c5`.

## Actual defect

`stopEmbeddedPostgresBounded()` previously swallowed any `cleanupFn` exception after the native POSIX `instance.stop()` promise fulfilled. After B1-194 introduced fail-closed identity checks for PostgreSQL test scratch, a replaced or foreign directory can correctly cause its reclaimer to refuse deletion; the stop wrapper nevertheless returned **success** and concealed that retained fixture. Windows already propagated cleanup failures.

## Minimal source repair

On the POSIX fulfilled-stop branch, call `cleanupFn?.()` without suppressing exceptions. Native stop rejection still fails closed, never runs the cleanup callback, and never claims quiescence. Native stop timeout still rejects without deleting a potentially running cluster; the original deferred stop promise retains its eventual cleanup callback. No change to process termination, database start, PostgreSQL binaries, customer data or retained directories.

## Regression

Two focused Vitest regressions in `packages/db/src/test-embedded-postgres.test.ts`:

1. A synthetic resolved native stop followed by a refused scratch reclaimer **must reject** instead of reporting a successful teardown.
2. A synthetic rejected native stop must **not invoke** the reclaimer.

An exclusive Linux Node 22, no-PostgreSQL prototype of the exact old/repaired promise behavior ran **4/4 PASS**: baseline masked cleanup refusal, repaired branch propagated refusal, verified stop cleaned once, rejected stop retained. The isolated prototype was removed after the run. This was **not** a native execution of the full repo's Vitest module, TypeScript 7, macOS or Windows; no real PostgreSQL, forced crash, browser or installed-app qualification is claimed. Repository Vitest regressions are committed for subsequent native execution.

## Open gates

Windows real forced-crash `io_worker` #234, exact-SHA compiled authenticated Chromium #237, root/server TypeScript 7, Linux bwrap, installed Windows/macOS/Linux, tenant/consent/privacy and donor license provenance remain unqualified. Retain the unverified `D:/Bostan-B212-qa` scratch; do not bypass the Desktop Commander usage limit. No merge, GitHub Actions, publishing or deployment.
