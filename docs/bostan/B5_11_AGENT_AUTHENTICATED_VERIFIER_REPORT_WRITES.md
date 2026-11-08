# B5-11 — Actual HTTP verifier report authoring from a scoped active agent run

**Private Bostan development, October 25 2026. No merge, deployment, release, public post, or paid AI.**

## A product-breaking mismatch found by test

B5-05 required a current strict `bostan.verification.report.v1` JSON task
report with source B4 HMAC citations. The original issue document REST
writer `PUT /api/issues/:id/documents/:key` only admitted `format:markdown`
at its public `upsertIssueDocumentSchema`, while previous B5 SQL tests
used an **internal `documentService` shortcut** to save a JSON report. The
actual assigned reviewer agent could therefore read the digest but not
write the required review report over the product HTTP API. A real run
could never complete the entire B5 authoring protocol through that path.

## Minimal source-compatible integration

Keep existing `@paperclipai/shared` issue document schema and ordinary
issue-document REST contract **markdown-only**. Only the original task
`PUT /api/issues/:id/documents/:key` now accepts an extra JSON body
variant where **key is exactly `bostan-verification`**, validated by the
same strict `bostanVerifierReport` Zod schema already used at final case
and task completion. JSON for any other document key is HTTP 400. The
strict report requires `schema:'bostan.verification.report.v1'`,
`verdict:'pass'`, 40–3000 character summary, and 1–10 unique
`{documentId,expectedSnapshotHmacSha256}` B4 source citations. Malformed
or unbounded data fails HTTP 400 before any document write.

The JSON exception *requires all of*: original `assertAgentIssueMutationAllowed`
and `assertDeliverableMutationAllowedByRunContext`; authenticated agent JWT
with current run ID; actor is the task's **currently assigned reviewer** in
this company; canonical `heartbeat_runs` row in `running` state for exact
company/agent/task, with a real start time; opt-in Case currently in phase
`verification`; a current actually **delivered** different-agent
`verification` handoff whose recipient is that reviewer and whose
`deliveredAt <= run.startedAt`. During stale-report recovery after terminal
intent, the immediately preceding delivery version is accepted only if
the current version is a matching original `awaiting_completion` terminal
intent from that same reviewer. Finished or foreign runs are denied 403.

The source `documentsSvc.upsertIssueDocument` retains existing revision
conflict semantics, original trust policy and canonical provenance:
`document_revisions.createdByAgentId` and `createdByRunId` use the
**authenticated actor**, never JSON fields claimed by a model. Every case
closure still rechecks run *success*, current authored revision and all
actual current B4 source HMACs; successful HTTP writing alone is not an
approval, provider verification, tool authorization or valid completed run.

## Real SQL + Express integration executed locally

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts src/__tests__/bostan-knowledge-evidence.test.ts src/__tests__/bostan-case-closure-routes.test.ts --maxWorkers=1`

**14/14 PASS**, zero failed/skipped, three files using actual isolated
PostgreSQL and original HTTP source routes/case/task services.

Integrated synthetic active reviewer now **GETs a current B4 source digest
over authenticated scoped HTTP, PUTs a strict versioned JSON review
over authenticated original task HTTP**, and a direct canonical SQL read
verifies the latest revision is attributed to the requesting agent and its
real `heartbeat_runs.id`. As its underlying source changes, the same
reviewer can run again, obtain updated digest and PUT a new report over
HTTP. This also works after accepted terminal intent; final Issue Done
rechecks provenance and succeeds only after re-review.

Negative HTTP cases include JSON to any ordinary document key (400),
invalid JSON report schema (400), a board impersonating report author
(403), and a previously successful but no longer **running** reviewer
trying to overwrite the report (403). All original case closure source
freshness/reviewer separation and source tenancy tests remain passing.

This is a **real REST/SQL authoring path with synthetic run/agent fixtures**.
The test did not use a real LLM, real remote provider, or conclude that a
reviewer claim is factually accurate.

## Open next integration

The inherited public MCP `upsert_issue_document` tool schema is still
markdown-only. An agent using **only that MCP tool** cannot yet submit the
JSON report; the authenticated REST path now can. Qualify a dedicated
narrow agent-tool contract or carefully scoped MCP schema integration
before advertising model-only end-to-end workflow. Full server TypeScript
remains resource-blocked on the shared Mac. Actual founder/CEO/specialist/
verifier inference, provider side-effect readback, Windows and Chromium,
B4 broad OCR/analytics, complete B5 autonomous acceptance and B6
packaging/release are OPEN.

Repo private, Actions disabled, main unchanged. **NO-GO.**

## Latest-head source-app qualification and actor caveat

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0**: actual private-local Bostan server HTTP health,
isolated real PostgreSQL, synthetic company insert, clean shutdown/restart
with exact same company, second clean shutdown and disposable profile
removal. `git diff --check` PASS.

For the HTTP tests, Express `req.actor` was injected as a **synthetic**
agent with `source:agent_jwt` rather than making a cryptographically issued
JWT and checking the full external authentication middleware. Backend
authorization and run/database provenance are real; JWT issuance,
transport, and an actual LLM tool call are **not** claimed qualified.
