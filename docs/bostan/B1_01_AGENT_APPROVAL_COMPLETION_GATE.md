# B1-01 — Do not allow agent self-certification with unresolved linked approvals

**Development implementation. B1 still in progress; no public release.**

## Gap in copied orchestration runtime

Existing issue update logic already refuses an agent's `done` transition when
there is an unresolved tool connection review. However the same update path
could complete an issue while its linked human approval remained `pending`
or `revision_requested`. That creates a false terminal signal while its
required human decision is still open.

## Implementation

- Extend the **existing authoritative `issueService.update` writer**, rather
  than adding another task or approval store. The check executes in the
  existing database issue-write transaction, immediately before the status
  update, after existing run-ownership and tool-action checks.
- When an `actorAgentId` tries `status=done`, select linked `issueApprovals`
  joined to `approvals`, scoped to the **same company AND exact issue**.
  Refuse pending or requested-revision approvals with HTTP 409 and stable
  `task_approval_pending` error code. The run should yield `in_review`,
  without re-attempting the governed operation.
- No false block when an approval is already approved, or when a pending
  approval is unlinked to the issue. A human board actor with existing
  authorization remains allowed to make an explicit disposition.
- There is no changed schema, model call, new external provider, policy
  bypass, or automatic approval decision. Existing company, run and tool
  action authority remain in force. No notification or data rebrand.

## Real verification — macOS / isolated PostgreSQL 17

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-agent-done-approval-gate.test.ts --maxWorkers=1`

**5 of 5 database integration tests PASSED**:

1. `pending` approval linked to task prevents agent Done; issue stays in progress.
2. `revision_requested` approval linked to task prevents Done; issue stays in progress.
3. Already approved linked approval permits normal agent completion.
4. Unlinked pending approval does not block unrelated work.
5. Authorized board completion is distinguished from self-certifying agent.

Database created in a fresh private test directory and removed after stop;
no external services or user databases. Full server TypeScript and diff check
are separate acceptance checks below.

## Open boundaries

This does **not** establish a complete independent output verifier, solve
cross-process serializability races with a separately created approval,
prove all possible privileged completion paths are gated, or qualify B1
concurrent multi-agent workloads. A full browser/native agent E2E,
company isolation attacks, scheduler crash recovery, budget policies and
revocation races remain B1 work. Existing required legal notices retained.
**Release NO-GO; private Draft only.**

### Final static acceptance

- Full server `pnpm --filter @paperclipai/server exec tsc --noEmit --pretty false`:
  **PASS, exit 0** after previously generated Runner declarations.
- `git diff --check`: **PASS**.
- Database tests all ran using the test-only opt-in isolated PostgreSQL
  fallback, not the source `embedded-postgres` image that cannot start on
  this Mac. These are real SQL/service updates, not mocks.
- Latest-branch B0-31 live source-runtime smoke also reran after this B1
  service update: **PASS**, real Mac PostgreSQL + private health + company
  insert + two clean server/database stops + exact UUID/name persistence
  across restart. Does not exercise an LLM or native Windows app.
