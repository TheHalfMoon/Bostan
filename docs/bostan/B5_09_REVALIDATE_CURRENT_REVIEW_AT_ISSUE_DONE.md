# B5-09 — Recheck current independent review *inside final Issue Done transaction*

**Private development, October 25 2026. Do not merge, publish, deploy, release or use paid providers.**

## The remaining time-of-check/time-of-use risk

B5-01..06 tied a Case terminal intent to a delivered distinct-agent
handoff, successful reviewer run, latest reviewer-authored JSON document,
and current B4 source HMAC fingerprints. B5-07 blocked direct Cases
`approved`/`done` writes; B5-08 blocked bare underlying Issue `done`
without a current accepted canonical terminal intent. But the **source
itself could still change between accepting that intent and the eventual
Issue Done**. A historical `state:awaiting_completion` case row is not
proof that the reviewed evidence remains current at final task completion.

## The canonical solution — one reusable source verification gate

Extracted the already-qualified B5-02..06 review verification logic from
`caseHandoffService` into `assertBostanCurrentVerificationEvidence` in
`server/src/services/bostan-current-verification-evidence.ts`. This is
**not** a second case/task/workflow owner; it is one stateless, read-only
shared verifier called from both canonical transactions:

1. At acceptance of an opt-in Case `to:done` intent, the original case
   service invokes it with the latest delivered reviewer handoff version.
2. At the **final locked Issue status transition to Done**, the source issue
   service first confirms a same-company, same-case, same-issue, current
   `awaiting_completion` terminal intent (B5-08), and now invokes that
   *same* full verifier under the existing transaction, using the
   immediately preceding delivered independent reviewer handoff version.

Both call sites enforce the *current* distinct reviewer assignment and
handoff delivery, a real succeeded canonical reviewer run started after
that delivery and finished without future dates, current/latest review
report authored by that reviewer *during* that matching run, strict
bounded `bostan.verification.report.v1` JSON, and **all canonical source
HMACs current and readable now**. The reads retain source `FOR SHARE`
locks inside the task/case transaction; no review text or private source
body is copied into case fields or a new ledger.

If a source was edited or unlinked after the case intent was accepted,
final Issue Done fails with the existing 409
`bostan_verifier_source_stale`. The task remains open, no case completion,
no terminal event, no tool effect and no false approval claim. Once the
assigned reviewer begins a *fresh* successful task run and records a
current report with new B4 source digests, the original guarded source
service can close the Issue/Case atomically.

### Reviewer source read after terminal intent

A reviewer whose source changed after terminal intent must still be able
to read the *new* digest. The B5-06 agent HTTP endpoint now accepts that
very limited state only when the **current** case handoff is a matching
`awaiting_completion` terminal intent from the *same reviewer*; it then
checks the previous version's delivered independent handoff. An absent,
cancelled, other-agent or wrong-company terminal intent cannot widen
access. It retains a currently running reviewer `heartbeat_runs` row,
task assignment, task privacy and no source text returned.

## Executed real Mac PostgreSQL + HTTP acceptance

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts src/__tests__/bostan-knowledge-evidence.test.ts --maxWorkers=1`

**12/12 PASS, zero failures/skips** on actual disposable system PostgreSQL.
The extended original Case handoff integration now executes:

- Current permitted reviewer GET digest → latest, versioned strict JSON
  review report → successfully completed reviewer run → `to:done` terminal
  intent accepted by source `caseHandoffService`.
- **After** terminal intent is accepted, an implementer revises the
  original cited source. `issueService.update(status:'done')` rechecks the
  report, rejects with `bostan_verifier_source_stale`, retains the pending
  intent, uncompleted task and uncompleted case; no tool effects occur.
- The same independent reviewer opens a new active run, obtains the changed
  source digest from the exact agent-scoped HTTP route under the current
  terminal intent, records a fresh current JSON report, completes its run,
  and finally source Issue Done and Case Done succeed in their normal
  transaction. The existing B4 tenancy/privacy HMAC tests remain passing.
- The source-run and human participants in these tests are **synthetic
  fixture rows**; this is *not* actual model/provider inference or factual
  trust attestation.

## Unfinished qualifications

The canonical transaction now guarantees source citation **freshness**, not
factual relevance, independent model quality, honest external action
readback or trustworthy attestations against a malicious local admin.
The runner, Windows/Chromium installed product E2E, B4 full OCR/retrieval/
analytics, B5 real founder→CEO→specialist→verifier with permitted effects,
full server TypeScript on adequate hardware, B6 packaging and a final
release remain OPEN. Repo private, Actions disabled and main untouched.
**NO-GO.**

## Latest-head actual runtime and compiler qualification

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS exit 0** on Mac: actual Bostan local HTTP health, isolated real
PostgreSQL, synthetic company INSERT, clean first stop, restart with exact
persisted company and clean second stop. Disposable test profile cleaned.

Full server TypeScript: `pnpm --filter @paperclipai/server exec tsc --noEmit
--pretty false` started the real compiler but **timed out under a guarded
95-second budget without finishing or returning any compiler diagnostics**.
The orphaned Mac typechecker process was explicitly stopped. The compiler
is **NOT QUALIFIED**; do not infer a clean server typecheck from passing
Vitest and source boot smoke. `git diff --check` PASS.
