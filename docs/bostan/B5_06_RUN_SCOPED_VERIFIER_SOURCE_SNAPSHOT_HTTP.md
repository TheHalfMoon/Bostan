# B5-06 — Run-scoped citation fingerprint read for independent verifier agents

**Private development, October 25 2026. No deployment, merge or public release.**

## A necessary actual-product bridge from B4 source to B5 review

B5-05 requires the current independent reviewer report to cite a B4 HMAC
fingerprint for the exact current canonical source version. Until B5-06 the
B4 read-only HTTP route was **board-only**. An authenticated verifier agent
could not obtain the snapshot without a privilege escalation or internal
service bypass. B5-06 exposes only that narrowly-scoped source digest under
its own endpoint, leaving original board endpoints unchanged:

`GET /api/companies/:companyId/issues/:issueId/bostan-verification/sources/:documentId/snapshot`

The caller must be an authenticated **agent with a current `runId`**. This
endpoint fails closed unless ALL of these current conditions hold:

- Actor's real tenant matches `companyId`, task is in that company, and the
  task's current `assigneeAgentId` is exactly the requesting reviewer agent.
- The actor's canonical `heartbeat_runs` record matches exact run, agent,
  company and task via issue/nativeIssue/context issue ID, with status
  **`running`** and a non-null start timestamp.
- An existing case owns this work task, has the **explicit opt-in**
  `fields.bostanIndependentVerificationRequired:true`, is currently in the
  `verification` phase, and its **latest** handoff version is an actually
  `delivered` agent handoff whose recipient is this caller, prior sender is
  a different non-null agent, and delivery predates the reviewer's run.
- The cited document has an existing exact company/task issue-document
  link, passes the original `issueReadSqlCondition(db, req.actor)` task
  privacy predicate, is not hidden/detached/deleted, and is not the
  `bostan-verification` report itself.

Success returns only a bounded, **private `Cache-Control: private,
no-store`** response:

```json
{
  "schema": "bostan.verification.source-snapshot.v1",
  "documentId": "<exact authorized source UUID>",
  "latestRevisionNumber": 1,
  "sourceSnapshotHmacSha256": "<current canonical B4 64-character digest>",
  "sourceContentIsUntrusted": true,
  "executionAuthorized": false,
  "factualRelevanceVerified": false
}
```

No excerpt, full source body, title, signing key, remote actor secret,
company-wide search, task mutation or tool execution permission is returned.
Reviewer agents can then save that digest in the strict, current
`bostan.verification.report.v1` JSON task document using the original
issue-document write path and original current-run provenance.

## Executed acceptance: actual Mac PostgreSQL + Express + original case runtime

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts src/__tests__/bostan-knowledge-evidence.test.ts --maxWorkers=1`

**11/11 PASS**, zero failures/skips, two test files against disposable real
PostgreSQL. New tests cover:

1. An opt-in real company/team/task has a **delivered** handoff from a
   distinct implementer to the assigned reviewer, followed by an active
   reviewer task run. The authenticated reviewer can GET only the current
   B4 HMAC, never original source text or an execution authorization.
2. A foreign-company agent, wrong agent/run, human board caller, stale or
   same-agent handoff, finished source run, missing source, hidden task and
   unlinked document all fail under their original privacy authority.
3. A separate **full in-process integration** takes the reviewer through
   source-snapshot HTTP retrieval → B5 JSON report creation in the original
   `documentService` → completed reviewer run → case terminal request.
   Editing the underlying source after successful review invalidates the
   report. A fresh active reviewer run obtains the new source HMAC via HTTP,
   publishes a new current revision, finishes successfully, and the
   original case service admits only an effect-free completion request.

This is a **real SQL/HTTP workflow** with synthetic human/agent actors and
synthetic run rows, NOT an actual AI/model inference, tool execution, remote
provider readback or independent third-party fact audit.

## Release gating

- Can Bostan run a real founder→CEO→specialist→independent verifier model
  workflow, within resource and spending bounds, and produce independent
  physical/provider readback instead of a self-authored model claim?
  **Not yet proven.** This endpoint only makes the necessary data flow
  possible under the existing source permissions.
- Full server TypeScript compile (Mac resource limits), Windows native
  first-agent, Chromium, B4 general OCR/retrieval/analytics, B5 real run
  with invalid/ambiguous effects, B6 installer/signature/accessibility,
  external product benchmarks and release are still open.

Repo private, inherited GitHub Actions disabled, main untouched. No paid
provider was used. **NO-GO**.

## Latest-head source-runtime acceptance

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS exit 0** on Mac: live private Bostan HTTP health, isolated real
PostgreSQL create, synthetic company insert, graceful stop/restart and exact
company persistence, second graceful stop; successful test profile removed.
`git diff --check` PASS. No live AI/provider action was attempted.
