# B1-05 — Revalidate human governance at native Done commit time

**Private source-development only, no release.** October 24, 2026.

## Race closed

The native run finalizer reads `pendingNativeGovernance` while computing its
completion disposition, but that read is not the final database transaction
which applies the decision. A new human approval, or sensitive interaction,
could be created and linked after the first read but before the native
status committer's `Done`. The generic B1-01/B1-02 agent Done gates were
intentionally bypassed by native status projection (system actor), because
the native arbiter owns its final status decision. This needed a separate
*authoritative native finalization* guard, not a fake agent identity.

## Implementation

- In `commitNativeStatusDecision` recheck `pendingNativeGovernance` **after**
  the issue row has been locked with `SELECT ... FOR UPDATE` and after valid
  superseded external review IDs have been verified, but **before** the
  terminal status and its effects are persisted.
- A newly pending human approval, actionable interaction or execution-stage
  governance gate now aborts native `Done` with `NativeStatusRaceError`.
  The entire transaction rolls back; it does not write a false Done, mark
  effects delivered or invent permission. The existing finalization recovery
  paths can re-arbitrate after the new state becomes visible.
- Previously verified superseded external reviews remain ignorable under
  their established protocol; arbitrary caller-supplied reviews are not
  trusted because the supersession check occurs in the same transaction.
- Real approval linking and interaction creation lock that issue row too,
  so finalization and new authority cannot commit in an unsafe order.
- No new task store, schema, external service, hidden approvals or model calls.

## Executed database tests (macOS, private ephemeral PostgreSQL 17)

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/native-status-arbiter-corpus.test.ts --maxWorkers=1`

- The new B1-05 tests insert a pending linked board approval **or** a
  pending governed confirmation **after** preliminary Done was already formed.
  Both must yield `native_status_race`, preserve `in_progress`, and never
  persist a false terminal status. **2/2 PASS**.
- Entire native-status-arbiter corpus: **46/46 PASS**, including original
  automatic review retirement, legacy/native compatibility and recovery tests.
  The fixture corpus checks **53 fixtures and 70 comparison matrix rows**.
- Explicit isolated PostgreSQL harness instead of this Mac's incompatible
  imported embedded database image; no real customer data touched.

## Remaining gates

Native high-contention stress, real agent execution under concurrent human
review, effect readback, leak prevention, cross-platform installer E2E and
B2–B6 product functionality are not qualified by these DB tests. Release
remains **NO-GO**. Repository private; Actions disabled; main unchanged.

## Final source and type qualification

- Full server TypeScript: `pnpm --filter @paperclipai/server exec tsc
  --noEmit --pretty false` **PASS (exit 0)**, with no source errors.
- Real macOS private source-app smoke after B1-05: `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1
  node scripts/bostan-local-live-persistence-e2e.mjs` **PASS (exit 0)**.
  Real PostgreSQL startup, private HTTP health, synthetic company creation,
  graceful stop, restart, verified exact data persistence, second clean stop.
- `git diff --check` **PASS**. No stray test PostgreSQL directories or
  Mac live test HOME after successful cleanup. No real external service.
