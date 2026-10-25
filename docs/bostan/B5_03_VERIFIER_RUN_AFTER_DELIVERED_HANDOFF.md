# B5-03 — Require an actual successful verifier-run record after case handoff delivery

**Private development, October 25 2026. No public release, merge, external provider or paid model.**

## Completion integrity improvement

B5-01 required the verifying agent be different from the implementer.
B5-02 required the original durable handoff into `verification` phase be
`delivered` and the task still be assigned to that distinct recipient, for
cases that explicitly opt in using
`cases.fields.bostanIndependentVerificationRequired:true`.

The delivered handoff is only evidence of assignment. It is not evidence
that the verifier ran. B5-03 now extends the **same** canonical
`caseHandoffService.acceptTerminal` transaction, before any terminal comment
or case version mutation:

- Read the exact latest `deliveredAt` timestamp from the already matched
  original verified handoff. A missing delivery timestamp is not sufficient.
- Require a **canonical `heartbeat_runs` row** with the same `companyId`,
  the **current assigned verifier's `agentId`**, a reference to the exact
  primary `issueId` (standard issue ID, native issue ID or canonical
  context snapshot), status `succeeded`, and non-null `finishedAt` at or
  after the durable handoff's delivery timestamp.
- A successful run of the original implementer, an old verifier run from
  before the handoff, a run for a different company/task, or a nonterminal
  verifier run cannot unlock closure. Missing qualifying run returns HTTP
  409 with stable `bostan_verifier_run_required`.
- Reuse imported run lifecycle/status and case identity authorities; no
  alternate run writer, completion marker, permissions bypass, schema
  migration, model inference or external API is introduced.

This proves only that **the original runtime records a successful reviewer
run after the task transfer**, not that the reviewer truly validated the
underlying work, that its model output is reliable, or that any external
side effect was independently verified. Independent signed review evidence,
provider state readback, and founder summary remain B5 release gates.

## Verified real Mac PostgreSQL tests

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts --maxWorkers=1`

**3/3 PASS**, zero fail/skip, with real isolated PostgreSQL and original
`caseHandoffService`. The B5-02 test now also exercises:
- A correctly delivered independent verifier handoff but **no completed
  verifier run** refuses terminal completion.
- A succeeded implementation-agent run on the same task refuses closure.
- A succeeded verifier run that predates delivery refuses closure.
- Only a same-company, same-task, same-verifier, post-delivery succeeded
  run row allows the original service to accept an inert terminal intent.
  All synthetic run rows are explicitly test fixtures, **not** real model
  execution receipts.

`pnpm --filter @paperclipai/ui exec vitest run src/pages/CaseDetail.test.tsx --maxWorkers=2`:
**14/14 PASS**. The read-only case details now explain both an independent
reviewer assignment and a successful task run are required by the opt-in
closure policy. Legacy cases do not show the policy notice.

## Remaining qualifications

No claim of independent content review, signed verifier artifact or
provider-action causal proof is made. The full B5 autonomous case remains
unfinished until actual authenticated model/agent runs, independently
verified provider/file effects and recovery/duplicates are exercised. Full
server TypeScript on this constrained Mac, Windows native first-agent E2E,
Chromium, B4 analytics, B6 packaging and release remain unqualified.
Private repository, inherited Actions disabled, main unchanged. **NO-GO.**

## Latest-head source runtime smoke

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0** on Mac. Isolated private PostgreSQL created, private HTTP
health verified, synthetic company persisted through clean stop/restart and
second clean stop. Successful disposable test profile cleaned.
`git diff --check` PASS. This does not mean real verifier/model execution
was conducted in the smoke.
