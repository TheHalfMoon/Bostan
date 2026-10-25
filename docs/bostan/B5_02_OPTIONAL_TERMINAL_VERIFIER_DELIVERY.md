# B5-02 — Require an independent verifier's delivered handoff before opt-in case closure

**Private development, October 25 2026. No deployment, merge, public release or paid providers.**

## Why B5-01 alone is insufficient

B5-01 made a `phase:verification` assignment to the same executing agent
invalid in the canonical case routing service. However the imported Cases
workflow separately supports requesting terminal `to:done` from an
implementation case without going through any verification handoff.
That could bypass the intended independent-review phase.

## Source-first optional case gate

A case can opt in to the structured company verification contract using:

`cases.fields.bostanIndependentVerificationRequired = true`

At the **existing** transaction-bound canonical
`caseHandoffService.acceptTerminal` boundary, B5-02 additionally requires:

- The case's current `phase` is `verification`, with a real currently
  assigned verifier agent.
- The exact newest handoff, pinned to the current company, case, issue and
  `handoffVersion`, is a `phase:verification` agent handoff with state
  **`delivered`**. A queued, pending dispatch, cancelled or stale handoff
  is never sufficient.
- Its saved `fromAgentId` must be non-null and **different** from its
  `toAgentId`; the latter must exactly match the current task assignee.
- All checks run inside the original locked issue/case terminal transaction,
  before adding the terminal comment, incrementing the case version or
  persisting a completion intent. Violations fail HTTP 409 with
  `bostan_verification_handoff_required`.

Legacy cases or cases without this explicit opt-in follow their existing
workflow without a retroactive breaking policy. B5-01 recipient eligibility,
permission checks, release fencing and durable handoff idempotency remain
owned by the original source. No duplicate task manager, extra DB schema,
model runner, provider tool, budget or machine consent is introduced.

**This establishes that an independent review handoff was delivered, not
that a verifier actually completed a trustworthy review.** An actual
verifier run, its accepted evidence and independent external state readback
must be linked in a later product acceptance gate before claiming verified
completion. The terminal request still goes through the original task
completion policy and cannot itself spend or execute external tools.

## Actual Mac PostgreSQL acceptance

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts --maxWorkers=1`

**3/3 PASS**, zero failures/skips on isolated real PostgreSQL and actual
canonical `caseHandoffService`:

1. Self-verification is rejected without changing the task, handoff or tool
   rows.
2. An opt-in case's direct terminal request fails before any handoff;
   an independent reviewer receives the work, but its queued/pending
   handoff still cannot authorize closure. A synthetic test fixture marks
   the original handoff as delivered (no AI/model execution), after which
   the canonical service accepts an inert `awaiting_completion` intent.
3. A separately identified verifier is still eligible to receive the task
   through the source manager and has correct durable `fromAgentId` and
   `toAgentId` provenance.

`pnpm --filter @paperclipai/shared exec vitest run src/case-handoffs.test.ts --maxWorkers=1`

The previously qualified **29/29 imported schema tests PASS** on the
prior B5-01 head. No request schema is changed in this wave.

## Remaining work

B5 still needs successful **actual** independent verifier execution and
signed, reviewable sign-off; correctly reconciled external effects, budget
and machine consent, founder-facing summary, interruptions/recovery,
real agent/browser E2E and Windows. Full backend TypeScript remains
unqualified after the earlier Mac compiler resource timeout. B6 and release
remain open. Repo private, Actions disabled, main untouched. **NO-GO.**

## Latest-head local Bostan source runtime

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
**PASS, exit 0** on Mac after B5-02: private localhost health,
isolated real PostgreSQL, synthetic company created, clean shutdown,
restart with exact company persisted, second clean shutdown, successful
disposable test profile cleaned. `git diff --check` PASS. This is not a
real live-provider run, verifier sign-off or Windows product acceptance.

## Read-only founder/board UI policy visibility

The existing `ui/src/pages/CaseDetail.tsx` is intentionally read-only;
authorized agent/API callers create and mutate cases. The page now renders
a visible **independent verifier handoff required** policy notice when the
canonical case `fields.bostanIndependentVerificationRequired` is exactly
`true`. It explains that a different agent must receive the review task
before the case can request closure. Legacy cases without the flag are
unchanged. The field is not duplicated as an editable arbitrary key in
the details table, and no new input or mutation control is introduced.

`pnpm --filter @paperclipai/ui exec vitest run src/pages/CaseDetail.test.tsx --maxWorkers=2`:
**14/14 PASS**, with two B5-02 regressions for enabled/disabled policy and
read-only UI behavior.

`pnpm --filter @paperclipai/ui exec tsc -b --pretty false`:
**PASS, exit 0**.

`CI=1 pnpm --filter @paperclipai/ui build`:
**PASS, exit 0**. Inherited >500kB bundle chunk warnings remain, not a
build failure. No network deployment or model run was needed.
