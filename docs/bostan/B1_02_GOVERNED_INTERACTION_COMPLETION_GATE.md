# B1-02 — Reject agent Done with pending governed interaction

**Private development, not a release qualification.** October 24, 2026.

## Risk

The copied task service already refused agent task completion while a tool
review was pending. B1-01 added protection for linked pending human approvals.
However an agent could still attempt `status=done` while a separate pending
*governed interaction* belonged to its task: for example a tool-action
confirmation, secret proposal, connection authorization, document verdict,
or unapproved connector enrollment. Ordinary questions and historical
inquiries must **not** become blanket blockers.

## Change

- Extend the existing `issueService.update` worker-owned Done gate, inside
  the current update transaction, with a scoped query of
  `issueThreadInteractions` by **both task UUID and company UUID**.
- Refuse only `status=pending` records with privileged metadata:
  `toolAction`, `secretProposal`, or `connectionAuthorization`; a pending
  confirmation aimed at `target.type=issue_document`; or `connection_intent`
  for a non-AI connection (including the `channel` purpose).
- Explicitly exclude per-user `connection_intent` with `purpose=ai` from
  this generic task gate; such login ownership has distinct runtime and
  human-responsible-user policies. Do not assume account access is granted.
- Return HTTP 409 with stable `task_governed_interaction_pending` and exact
  pending interaction ID. Never mark the task Done on this failed request.
  The worker should yield for authorized review rather than replaying a
  governed operation or pretending that consent was obtained.
- Pending normal questions, resolved/dismissed historical responses,
  unrelated tasks, and an existing authorized *board actor* decision are not
  blocked by this agent-only gate. Closing from the board still follows the
  imported explicit-operator controls.
- No schema change, alternate task manager, new connector, outgoing network
  call, model execution, or default remote egress.

## Real database verification

macOS + disposable isolated system PostgreSQL 17:

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-agent-done-governed-interaction.test.ts src/__tests__/bostan-agent-done-approval-gate.test.ts --maxWorkers=1`

**15 PASS / 0 FAIL** across the two B1 DB files. B1-02 exercised:

- pending tool action, secret proposal and connection authorization;
- pending document verdict;
- an actual `connection_intent` for an unapproved channel;
- a per-user AI-account login not turned into a universal worker blocker;
- harmless ordinary pending confirmation;
- resolved governed request;
- unrelated different issue;
- authorized explicit board completion.

These are real SQL transactions through `issueService.update` with synthetic
test data, not claims that a live connector was executed. All private
PostgreSQL test clusters were stopped and removed after testing. No provider
model or external identity service was contacted. `git diff --check`: PASS.

## Qualification limits

Does not qualify every agent completion path (some native completion contracts
have separate arbiters), new approval creation races, attacker-controlled
payload insertion, dynamic external-effects readback, secret-delivery
rollback, concurrency under heavy load, Windows runtime E2E or final
application distribution. A full B1 authorization and race audit remains.
No merge to main, deployment, publication or paid services. **NO-GO.**

### Final source/runtime verification

- Full server TypeScript:
  `pnpm --filter @paperclipai/server exec tsc --noEmit --pretty false` —
  **PASS, exit 0** when executed without a concurrent heavyweight database
  suite. An earlier overlapping check was intentionally cancelled due to
  local resource pressure; that cancelled run was never counted as a pass.
- Real Mac source-app smoke after the B1-02 gate:
  `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
  **PASS, exit 0** — private HTTP health, synthetic company creation, stop,
  restart, exact persistence, and second clean PostgreSQL stop.
- All B1-01 and B1-02 SQL tests completed with **15 PASS / 0 FAIL**;
  no isolated PostgreSQL test directories left afterward.
