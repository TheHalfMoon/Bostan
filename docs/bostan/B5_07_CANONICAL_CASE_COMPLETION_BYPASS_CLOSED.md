# B5-07 — Close direct Cases status/opt-in policy bypass around B5 independent review

**Private development, October 25 2026. No release, merge, deployment or paid provider.**

## Actual product safety bug

B5-01–06 enforce distinct specialist/verifier agents, delivered verification
handoff, current successful verifier run, current reviewer-authored report and
current HMAC-bound source citations inside the **canonical** case handoff
completion transaction. However, Cases also exposes generic `PATCH
/api/cases/:id` and idempotent `POST /api/companies/:companyId/cases`
(upsert), each directly writing `cases.status` and `cases.completedAt`.
An agent with generic case mutation rights could claim `status:done` or
`status:approved`, without meeting *any* B5 case-handoff requirements, or
replace `fields` to remove the explicit opt-in review requirement.

## Source-first repair

`assertBostanCaseClosurePolicy` is a shared, side-effect-free validation
helper executed **inside the existing original Cases write transaction** at
all three entry points:

- New `POST`: an opt-in case cannot be created as `approved` or `done`;
  normal `draft`/in-progress case creation is unaffected.
- Keyed `POST` upsert: an already opted-in case cannot transition to
  `approved`/`done` or silently lose its review policy through replacement
  of `fields` with `{}`/`false`/other objects.
- `PATCH`: direct `approved` or `done` transitions are denied for opted-in
  cases, and an existing `bostanIndependentVerificationRequired:true` cannot
  be removed by field replacement. Attempts to retroactively attach this
  review requirement to an already approved/done case are also denied.
- Failures return HTTP 409 with stable, inspectable codes
  `bostan_canonical_case_completion_required` or
  `bostan_independent_review_policy_immutable`, *before* case status, event,
  audit, labels or ownership mutations.
- A no-op metadata update of an opted-in case remains possible. A case that
  never opted in keeps the imported canonical Cases status behavior.

The repair does not create a second case state machine or grant review
permissions. Actual approved/completed status for opted-in cases can only
come from the imported case handoff/task completion lifecycle.

## Real local SQL and HTTP acceptance

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-case-closure-routes.test.ts --maxWorkers=1`

**2/2 PASS, 0 failures/skips**, with real isolated PostgreSQL, real
Express `caseRoutes`, the source Cases feature gate and actual original
transactions. Acceptance covers creating approved/done reviewed cases,
keyed upsert and direct PATCH attempts to bypass sign-off, removing a
review requirement by erasing/replacing its `fields`, retroactively
attaching a fake requirement to an already completed case, non-executing
metadata changes and successful normal-case legacy completion. Original
case row remains non-completed and policy stays `true` after every denied
request. No external tool invocation or paid model.

The inherited `cases-routes.test.ts` suite was first attempted but **all
30 tests skipped** on this Mac because its embedded PostgreSQL bootstrap
failed; a dedicated real *system* PostgreSQL test file above was added to
avoid pretending a skipped test suite was qualified. This new suite passes.

## Still outstanding

The generic HTTP Cases status bypass is closed for opted-in instances.
B5 must still qualify actual agent execution, honest independent factual
judgment, file/provider-effect readback and all alternate task completion
paths; the field is not a retroactive evidence proof. Windows installed
product, browser E2E, full server TypeScript build, B4 retrieval analytics,
B5 real company orchestration, B6 installer and release remain open.

Private GitHub repo, inherited Actions disabled, main unchanged. **NO-GO.**

## Latest-head local application smoke

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0**. Actual Mac private Bostan server health, isolated real
PostgreSQL, synthetic company creation, clean shutdown, restart with exact
persisted company and second clean shutdown; disposable test profile removed.
`git diff --check` PASS. This is a startup/persistence smoke, not a full
agent/model/browser release test.
