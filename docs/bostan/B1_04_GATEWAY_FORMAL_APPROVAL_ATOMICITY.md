# B1-04 — Atomic formal board approval creation in the tool gateway

**Private development, not release.** October 24, 2026.

## Remaining B1-03 gap

B1-03 locked issues during `issueApprovalService.link()` and
`linkManyForApproval()`. The actual high-risk Tool Gateway did not use
those methods: it inserted a pending formal approval into `approvals` and
then a row in `issue_approvals` without locking the task. It could therefore
create a late pending approval and link after agent Done had already been
committed. If linking failed, the inserted formal approval could be orphaned.

## Implementation

- New narrow `issueApprovalService.createPendingToolApproval` is the single
  gateway formal approval creation + linking operation. One PostgreSQL
  transaction takes the task row lock (`FOR UPDATE`) before inserting either
  row; checks the exact issue and company IDs; refuses tasks already Done or
  Cancelled; inserts a pending formal board approval and its link atomically.
- Both data mutations roll back together when admission fails. No orphan
  approval can be committed merely because the task status changed during
  this transaction.
- The imported Tool Gateway now calls that existing service instead of
  directly writing `issue_approvals`. If admission fails, it cancels the
  previously pending tool action request before propagating the error; no
  approval card or signed execution request is created by that path.
- Existing high-risk tool approval semantics, payload, owner and signature
  remain the same. There is no new credential store, schema migration,
  service, paid model or remote dependency.

## Executed tests — real isolated PostgreSQL 17 on Mac

- `bostan-gateway-formal-approval-atomicity.test.ts`: **5/5 PASS**.
  Verifies atomic approval+link creation and subsequent agent Done refusal;
  no orphan approval/link on already Done/Cancelled tasks; explicit company
  isolation; and a separate concurrent database transaction closing an
  issue while gateway approval creation waits for the same row lock.
- B1-03 `bostan-approval-link-atomicity.test.ts`: **7/7 PASS**.
- Actual imported `tool-gateway-service.test.ts` full suite with the
  isolated system PostgreSQL test harness: **59/59 PASS**, including the
  full destructive tool approval and signed replay test. Original embedded
  PostgreSQL on this Mac still fails, so the opt-in independent test
  database harness is used here. Existing test behavior and runtime gateway
  semantics are not replaced by mocks of the approval call.
- No customer data, network calls to a real service, or paid LLM execution.
  The temporary isolated database cluster was stopped and removed.

## Remaining gates

- Full server TypeScript acceptance, real macOS source-app startup/restart
  and Windows first-agent/installer E2E on this exact branch must be
  recorded separately. Source DB tests do not prove consumer release.
- Independent external-effect readback, concurrent approval revocation,
  secret delivery rollback, budgets, leases, failure recovery, and B2–B6
  remain open. Development PR stays private/unmerged, GitHub Actions
  disabled, main unchanged. **Release NO-GO.**

## Final validation receipt

- Full server `pnpm --filter @paperclipai/server exec tsc --noEmit --pretty false`:
  **PASS, exit 0**. This also closes the earlier B1-03 same-frontier
  typecheck timeout gate for the combined B1-03+B1-04 source head; the older
  standalone B1-03 report remains historically accurate for that run.
- Real private macOS source-app persistence after the gateway change:
  `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
  **PASS, exit 0**. Two clean stops around a restart, saved synthetic company
  restored exactly, and no external provider/model used.
- `git diff --check`: **PASS**; no orphan isolated PostgreSQL test clusters,
  live Mac temp profile, or TypeScript process left by the qualification.
