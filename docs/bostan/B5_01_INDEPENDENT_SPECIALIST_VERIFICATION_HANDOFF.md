# B5-01 — Enforce an independent verifier at the existing case routing boundary

**Private source development, October 25 2026. No model execution or release.**

## Actual Bostan orchestration change

Bostan inherits a canonical cases/tasks/agent hierarchy, assignment-policy,
durable case handoff and execution recovery runtime. The B5 founder/CEO /
specialist/independent-verifier workflow needs an enforced separation of
roles rather than relying on a prompt asking the implementer to review its
own work. The prior `case-handoffs` transfer authority could assign
`phase=verification` back to the task's current implementing agent.

B5-01 adds `requireIndependentVerifier` *inside the existing authoritative
case routing service*, not a second task/worker authority:

- At a case handoff requesting `phase:verification` for an **existing** work
  task, compare the current implementing `issues.assigneeAgentId` with the
  requested `toAgentId`. A self-assignment fails before writing a handoff,
  case version, task reassignment, comments or an execution wake, with
  `bostan_independent_verifier_required` (HTTP 422).
- The same condition is repeated inside delayed handoff `apply()` while
  source version, task authority and existing original principal permissions
  are locked/revalidated. This prevents pending/legacy rows from bypassing
  the admission rule at actual dispatch.
- Separate eligible verifier agents still use the inherited validated
  `assertAssignableAgent`, company/task permissions, durable handoff version,
  owner/issue rechecking, and existing recovery paths. Case identity,
  task/workspace ownership, budgets, machine consent and agent policies
  remain owned by their imported canonical modules.
- A board-created new case with no prior implementing agent does not invent
  an executor identity. Other phases like implementation and correction are
  not blocked by this verifier-only requirement.

The rule establishes **agent identity separation for this handoff**, not
actual independent factual verification. It does not enforce a provider
readback, detect a coordinated verifier colluding with the implementer, or
prevent someone closing a task through other canonical paths. Those remain
B5 acceptance gates.

## Verified real Mac SQL and source schema contracts

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts --maxWorkers=1`

**2/2 PASS**, with real isolated PostgreSQL, the original
`caseHandoffService.handoff` and an actual company/CEO/specialist/verifier
hierarchy. Self-verification fails with HTTP 422, leaving the exact task
owner/version and case version intact, zero pending handoff rows, zero tool
invocations. Assigning an independent verifier works using the original
case handoff service and updates the task assignee with durable source
`fromAgentId`/`toAgentId` provenance; no real paid model or tool dispatched.

`pnpm --filter @paperclipai/shared exec vitest run src/case-handoffs.test.ts --maxWorkers=1`

**29/29 PASS** for imported case handoff request/schema contracts.

## Remaining critical B5 gates

- No multi-agent real model execution happened here. This is a real SQL
  authority test with synthetic actors and tasks, not a founder-to-CEO-to-
  agent-to-tool-to-verifier-to-evidence product E2E.
- Verifier sign-off, true action effect readback, budget/machine consent,
  unknown external outcomes, rollback/restart, and independent acceptance
  require further real run qualification.
- Full server TypeScript remains unqualified on the resource-limited Mac;
  Windows native and Chromium product qualification, B4 retrieval/analytics,
  B5 total flow, B6 packaging/accessibility and release remain open.
- Do not publish, deploy or merge. Repo private, Actions disabled,
  main unchanged. **NO-GO**.

## Latest-head local source runtime acceptance

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
**PASS, exit 0** on Mac after B5-01: verified private-local health,
a disposable isolated PostgreSQL cluster, synthetic company INSERT, clean
stop, restart with exact persisted company and second clean stop. Successful
temporary test profile removed. `git diff --check` PASS. This does not
substitute for Windows native or real AI/tool action acceptance.
