# B1-03 — Serialize approval linking against task completion

**Private development, not an installer or release.** October 24, 2026.

## Confirmed race

B1-01 prevents an agent from marking a task Done if a pending approval is
already linked. However the inherited `issueApprovalService.link` and
`linkManyForApproval` read the task status in separate queries **before**
writing `issue_approvals`. A concurrent Done transaction could close the
issue between the initial validation and insertion, creating a pending
approval link *after the completion guard ran*. This is a true
check-to-use race even when requests target the same company.

## Corrective implementation

- Both approval link paths now use one `db.transaction`.
- Lock task rows via `SELECT ... FOR UPDATE` before reading approvals or
  inserting links. The authoritative `issueService.update` obtains the
  same task-row lock before its Done guard, so link and completion now
  serialize consistently on that row.
- Lock the approval with `FOR SHARE` for the duration of link admission.
- Refuse linking a `pending` or `revision_requested` approval to a task
  already `done` or `cancelled`: HTTP 409 and stable
  `issue_terminal_approval_link` with exact IDs.
- Preserve ability to attach already `approved` or otherwise resolved
  approvals to historical completed tasks for audit purposes.
- Bulk link locks all task rows **sorted by UUID**, validates all in a
  single transaction, and inserts either all or none. Cross-company links,
  unknown issues and unapproved completion races cannot leave a partial
  group of links.
- No new schema, task scheduler, network service, LLM provider, or
  production database migration.

## Real PostgreSQL tests

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-approval-link-atomicity.test.ts --maxWorkers=1`

**7/7 PASS** against an isolated ephemeral PostgreSQL 17 cluster:

1. Pending approval linked to an open task prevents agent Done.
2. Pending approval to an already Done task is refused.
3. Pending approval to a cancelled task is refused.
4. Approved historical decision may link to Done task.
5. Bulk link refuses a closed member and inserts **zero** links.
6. Bulk link refuses another tenant's task and inserts **zero** links.
7. An independent transaction holds the task row lock, then commits Done
   while a concurrent link waits. Once released, link reads the new terminal
   state and fails with 409; no lingering pending approval link exists.

The tests use only synthetic company/task IDs, actual PostgreSQL row locks
and the existing authoritative service. They did not contact external
providers or touch user databases. The test cluster was cleaned after use.

## Outstanding qualification

The separate low-level tool-gateway approval creation path is not yet covered
by this change; it inserts `issueApprovals` directly and must be independently
reviewed for the same race. This wave also does not prove database deadlock
freedom under all multi-actor workloads, complete action outcome verification,
Windows live E2E, installers, final security/privacy checks or B2–B6.
`main` unchanged, repository private and Actions disabled. **Release NO-GO.**

### Final regression receipts

- Latest-head B0-31 real Mac source-app smoke:
  `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
  **PASS (exit 0)** — local private health, synthetic company creation,
  shutdown, restart and exact company persistence, second clean PostgreSQL
  shutdown. No model execution or external provider call.
- Full server TypeScript qualification for this B1-03 head is **NOT
  QUALIFIED**: one compiler run was manually stopped after excessive local
  runtime; a second bounded run exceeded **135 seconds** and exited 124.
  Neither run produced specific source/type errors, but an empty log is not
  proof of type correctness. An inferred-return annotation was added to
  the two linking functions and persisted; a clean server typecheck must
  still pass before final release gates.
- `git diff --check` PASS; local test PostgreSQL clusters and live Mac
  persistence HOME were cleaned after successful tests. The test compiler
  child was explicitly terminated after the timeout, rather than left to
  consume resources.
