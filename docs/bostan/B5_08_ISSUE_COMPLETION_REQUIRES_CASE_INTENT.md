# B5-08 — Prevent generic Issue Done from bypassing opted-in independent case review

**Private Bostan development, October 25 2026. No merge, release, deploy or paid provider.**

## Product gap and source authority

B5-07 closed the generic Cases POST/PATCH `done` bypass. However the
canonical `issueService.update` still allowed a board or agent caller to set
the *underlying task* to `done` without first accepting a reviewed terminal
handoff. Its subsequent `completeTerminalCaseHandoffsForIssue` only completes
a previously accepted handoff if one exists, but the bare Issue `done` value
could be used as a misleading task-level completion claim on an otherwise
unreviewed B5 case.

B5-08 introduces a minimal read-only gate
`assertBostanIssueCompletionHandoff` inside the original issue write
transaction, **after the Issue is locked and actor execution fencing runs,
before any `issues.status`/case/audit changes**.

For a transition to `done`, the gate reads any canonical same-company Cases
whose `workIssueId` equals the task and whose persisted JSON `fields`
explicitly opts in with `bostanIndependentVerificationRequired:true`. For
each such case, it requires the **current** case handoff version to have a
same-company, same-case, same-issue original `caseHandoffs` row in
`destinationKind:done` and `state:awaiting_completion`, with its
`fromAgentId` matching the task's current assigned agent. Source rows are
held under SQL `FOR SHARE` in the task mutation transaction. A missing,
wrong-version, wrong-agent, cancelled or pending verification handoff fails
HTTP 409 `bostan_case_terminal_handoff_required` without mutating task
status. The original terminal service still owns the actual case closure,
final actor scope checks and activity audit. No second worker or release
mechanism has been introduced.

Cases without the opt-in flag and ordinary issues are unaffected. A repeated
no-op update on an already completed task does not need to reissue a handoff;
task reopening/reassignment still uses the original cancellation rules.

## Executed Mac SQL qualification

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts --maxWorkers=1`

**4/4 PASS, zero failed/skipped**, real isolated PostgreSQL, original
`issueService`, original `caseHandoffService`, original current-source
B4/HMAC document report flow. Adversarial acceptance asserts that a founder
cannot directly mark the work Issue done before the independent reviewer
handoff, without changing the source task/case/handoff rows. The existing
B5-01..06 integrated test also exercises accepting a current reviewer
report, authentic terminal handoff intent, then Issue `done` and actual
canonical case `done` as one source lifecycle. A legacy non-opted-in case
still permits ordinary task completion without a special handoff.

All actors, run and review documents are synthetic test fixtures; this is
not actual model execution or independent real-world effect proof.

## Known follow-up

This gate establishes **handoff presence** immediately before final task
Done. A cited original source could change *after* the case's completion
intent was admitted and *before* Issue Done, making the previously accepted
review report stale. A final same-transaction source freshness recheck is
needed before claiming end-to-end provenance; do not treat a historical
accepted case intent alone as current evidence.

The larger founder/CEO/specialist/independent verifier sequence, autonomous
model quality, human authorization, third-party effect readback, Windows,
Chromium, full backend TypeScript, B4 analytics, B5 final acceptance,
B6 distribution and release remain unqualified. Repo private, Actions
disabled, main unchanged. **NO-GO.**

## Latest-head source-app smoke

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0** on Mac, real localhost health and isolated PostgreSQL,
synthetic company insert, graceful stop/restart with exact persistence, second
clean stop and temporary test HOME cleanup. `git diff --check` PASS.
