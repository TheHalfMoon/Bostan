# B5-04 — Bind independent review closure to current verifier-authored report revision

**PRIVATE development, October 25 2026 — no public release, merge, deployment or paid provider.**

## Functional gap closed

B5-03 ensured a positive `succeeded` heartbeat run from an independent verifier
started only after delivery, for the same exact task. A `succeeded` runtime
status does NOT imply that the verifier recorded any actual review evidence.
An implementation author could also overwrite a review document after the
independent reviewer ran, making a historical review unverifiable.

B5-04 augments the same existing locked `caseHandoffService.acceptTerminal`
transaction **only for cases with `fields.bostanIndependentVerificationRequired:
true`**. It uses the existing `issue_documents` → `documents` →
`document_revisions` join as the canonical source of truth; no shadow ledger.

The opt-in case can request a terminal intent only when:

1. The latest distinct-agent verification handoff was actually delivered,
   not just queued/pending, to the same current task assignee and version.
2. The original `heartbeat_runs` row of that current verifier is genuinely
   successful for the same company, task and agent. Its `started_at` must
   be **at or after** handoff delivery; `finished_at` must be non-null,
   after start/delivery and **not in the future**. The relevant runs are
   held under PostgreSQL `FOR SHARE` in the decision transaction.
3. The **current** document named `bostan-verification` is linked to the
   same canonical issue/company. Its **latest** revision points to the same
   verifier agent and one of those successful reviewer run IDs. The
   latest revision timestamp is within its author run's actual time window.
   The document must not retain an unreviewed/low-trust `sourceTrust`, and
   its current body must have at least 40 non-whitespace characters.
4. The document and linked revision are held under `FOR SHARE`. A later
   rewrite by the original specialist, a missing document, stale revision,
   wrong run/agent, old pre-delivery or future-dated run, or rewritten body
   fails closed before creating a terminal comment or incrementing case
   version, using `bostan_verifier_document_required` / the prior run gate.

The report's content stays in original document storage: **no raw body,
HMAC, secret or summary is copied into the case status or another table**.
The CaseDetail read-only page tells an opted-in case operator that a current
report and successful independent reviewer run are needed for closure.

## Verified source tests

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts --maxWorkers=1`

**3/3 PASS**, zero fail/skip, isolated real PostgreSQL and the canonical
case handoff/`documentService.upsertIssueDocument` sources. The test
exercises refusal before assignment, missing delivered handoff, wrong-agent
review, missing success, missing report, implementer-authored report,
valid reviewer-authored current revision after a reviewer run, subsequent
implementer rewrite invalidating signoff, and later fresh verifier review
run restoring a current report. No model/provider actually executed in the
synthetic fixtures; task status & report authorship are genuine SQL rows.

`pnpm --filter @paperclipai/ui exec vitest run src/pages/CaseDetail.test.tsx --maxWorkers=2`

**14/14 PASS**; read-only page distinguishes opt-in requirement from legacy
cases and has no invented case-edit action.

`pnpm --filter @paperclipai/ui exec tsc -b --pretty false` and
`CI=1 pnpm --filter @paperclipai/ui build`: **both PASS**; source includes
only non-fatal inherited >500KB JavaScript chunk warnings.

## Strict limitations / release gates

A model-authored document with a successful native run is an **attributed
review record**, NOT cryptographic external effect proof, fact checking,
independent human approval or a trustworthy signed content claim. The
existing source's `createdByRunId` is written under its original API/actor
boundary, and does not itself constitute an independent remote attestation.
There is deliberately no new model, external spend, cloud inference or
privilege change. Current transaction gates do not on their own prove
idempotent provider reconciliation, consent, safe deletion, evidence-backed
founder summary or an actual end-to-end CEO→specialist→verifier cycle.

Still open: real agent execution and model/runtime quality evidence,
independent external file/provider readback, provenance signing/revocation,
whole-server TypeScript qualification, Windows/Chromium E2E, B4 analytics,
B5 full company acceptance, B6 packaging and release. Private repo and
GitHub Actions disabled; main unchanged. **NO-GO.**

## Additional source-runtime and resource qualification

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0** on Mac. Actual private-local Bostan HTTP health, isolated
PostgreSQL initialization, synthetic company inserted, first clean stop,
restart with exact persisted company, and second clean stop; successful
disposable QA HOME removed.

**Full backend TypeScript is NOT QUALIFIED.** Normal server `typecheck`
ran the imported Rust runner-vendor prebuild and exceeded a guarded 75-second
limit; direct `tsc --noEmit` likewise exceeded a guarded 46-second limit on
the highly constrained/shared Mac. Both subprocess trees were stopped;
only 835 MB of generated `packages/paperclip-runner/runner/target` from this
disposable Bostan checkout was removed, recovering disk space. No source,
user data, npm dependency store or another project's files were deleted.
No success is inferred from the compiler timeouts. Finish static server QA
on a suitable resource-qualified machine before any release candidate.
