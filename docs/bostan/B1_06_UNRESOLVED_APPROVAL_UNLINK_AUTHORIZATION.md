# B1-06 — Prevent an agent bypassing the human-approval Done gate by unlinking consent

**Private development, not release.** October 24, 2026.

## Security issue

The inherited routes allowed CEO-class agents and agents with
`canCreateAgents` permission to add AND remove issue approval links. B1-01
and B1-05 correctly held the issue at `in_review` whenever linked human
approval was `pending` or `revision_requested`, but an authorized management
agent could first unlink this still-unresolved approval, then self-certify
`Done`. Permission to maintain the task association is NOT permission to
bypass human authorization.

## Implementation

- `issueApprovalService.unlink` now locks the company-owned issue row in a
  transaction, then reads the associated approval with a shared lock.
- An agent or unknown internal caller is refused with HTTP 403 and stable
  `unresolved_approval_board_only` if the approval is `pending` or
  `revision_requested`. The association remains intact so task completion
  continues to respect the outstanding human authority.
- An authenticated **board** actor is still allowed to explicitly change
  links. Existing route authorization is unchanged and now passes
  `isBoard: req.actor.type === 'board'` to the service. A caller cannot
  authenticate as the board merely by supplying a request-body flag.
- For already decided / historic approvals, existing authorized agents may
  continue managing links. Cross-company issue/approval combinations fail
  before any delete; the SQL delete is additionally scoped to company ID.
- The same task row lock used by B1-03 links and `issueService.update`
  serializes removal against completion. No schema migrations, user-data
  changes, new task store, external network calls or new paid dependencies.

## Executed tests

- Real isolated PostgreSQL on macOS:
  `BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-approval-link-atomicity.test.ts src/__tests__/bostan-gateway-formal-approval-atomicity.test.ts --maxWorkers=1`
  **16/16 PASS** (11 approval link/ownership + 5 Tool Gateway formal
  approval cases, zero failures and zero skips).
- Four B1-06 scenarios cover: blocking an agent from unlinking a pending
  approval and then failing agent Done; explicit authorized board unlink;
  ordinary historic approval unlink by an authorized agent; rejecting
  requested-revision unlink and cross-company approval deletion.
- Focused synthetic source test admission: 3/3 PASS. `git diff --check`: PASS.

## Still unqualified

This controls the public issue approval link route and issue approval service;
other direct table mutation paths, live external action readback, revocation
races, lease safety, cross-platform first-agent QA, independent verification,
installer, B1 remaining and B2–B6 are NOT claimed complete. `main` remains
untouched, repo private, actions disabled, all work Draft. **Release NO-GO.**

### Final qualification on this branch

- Latest B1-06 macOS real source-runtime smoke:
  `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
  **PASS (exit 0)**. Local-trusted private health, synthetic company insert,
  two graceful stops and exact same company after PostgreSQL restart.
- Full server `tsc --noEmit --pretty false`: **NOT QUALIFIED** on this head.
  A standalone run with a hard **165-second** resource cap exceeded its
  timeout and was terminated (exit 124) without compiler diagnostics. A
  silent compiler is not a successful typecheck; this remains an explicit
  follow-up acceptance gate. Earlier B1-05 successful typecheck is NOT
  represented as passing for B1-06 changes.
- The 16/16 real PostgreSQL tests and `git diff --check` **PASS**. No
  isolated test PostgreSQL clusters, lingering compiler process or live
  test HOME remain after successful cleanup.

### Windows source regression (separate device)

- Windows `Abdulaziz`, Node v24, fresh detached QA worktree pinned to
  `81fd3c3f8fff45c70419065237588f465d479273`, without modifying the
  older Windows source checkout or its untracked QA scripts.
- Eleven source/CLI Node test files covering local runtime, stop/recovery,
  NTFS ACL, free first-agent admission policy, free Opencode guard, cold
  snapshot, guides/frontdoor/branding and live smoke admission:
  **83 total; 77 PASS, 0 FAIL, 6 POSIX-only skips**. There was no actual
  AI model inference, Windows consumer installer or fresh PostgreSQL service
  in this run. Those qualification gates remain open.
- Temporary detached QA worktree was safely removed after checking the
  exact HEAD and clean working-tree status. D: free space restored to
  **4.38 GB**; the original Windows checkout and untracked scripts remain.

### Second compiler attempt

- Added an explicit `Promise<void>` return annotation to the transactional
  unlink API to avoid unnecessary inferred generic types. With this change
  present, server TypeScript still exceeded a **175-second** cap without
  diagnostics; run terminated with exit 124. This is **NOT A PASS** and
  remains a source qualification blocker. No compiler process left behind.
