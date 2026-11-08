# B4-03 — Bounded, point-in-time, all-or-nothing citation set freshness

**Private Bostan source development, 2026-10-24; no release or action authority.**

## Why individual source freshness was insufficient

B4-02 checks whether one signed, current task document matches the original
source version. A founder/board recommendation can reference multiple
independent documents. Checking each outside one database snapshot risks
mixing source versions if they change mid-review, and blindly accepting a
subset would silently omit a stale or missing mandatory citation.

B4-03 adds a board-only batch source freshness surface:

`POST /api/companies/:companyId/bostan-evidence/snapshots/freshness`

- Strict body `{sources:[{issueId,documentId,expectedSnapshotHmacSha256}]}`
  with 1–10 **distinct** citation identities, exact UUIDs and lowercase
  64-character HMACs. Empty, duplicate, oversized or malformed sets are
  rejected before any database scan. No user-supplied query/root/schema.
- Requires authenticated board membership for the company and the original
  source `company_scope:read` authorization. The existing
  `issueReadSqlCondition(db, req.actor)` is pushed down into every source
  query; agents and ordinary board actors from another company are denied.
- Performs every B4-02 canonical source check in one **PostgreSQL
  `repeatable read` / `read only` transaction**. Any inaccessible, hidden,
  detached, deleted, stale or mismatching source forces
  `allSnapshotsCurrent:false`. The snapshot is a consistent source set at
  one point in time, not a lock across future board decisions.
- Returns only a single boolean, total citation count and conservative
  flags: `factualRelevanceVerified:false`,
  `decisionCommitAuthorized:false`, `sourceContentIsUntrusted:true`.
  It does not return individual inaccessible IDs, source bodies, snippets,
  document titles, old/current HMAC values or secrets; `Cache-Control:
  no-store` applies. Nothing is stored or dispatched.
- Uses the canonical `documents`/`issue_documents`/`issues` model from the
  donor source and B4-01; no second index, task authority, knowledge cache
  or separate document permissions are created.

## Executed macOS real PostgreSQL + HTTP QA

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-knowledge-evidence.test.ts --maxWorkers=1`

**7/7 PASS, zero failing/skipped** using isolated real PostgreSQL,
canonical document mutations and actual Express routes. New acceptance:
- Two correctly referenced and current documents return true.
- A change in source #2 returns false despite source #1 remaining valid.
- Removing source #2's canonical issue link returns false.
- Duplicate source IDs, an empty set and more than 10 citations are rejected.
- Normal foreign-company session board and agent actors cannot probe the
  citation set. A hidden source cannot be accepted.
- All inherited B4-01/B4-02 real SQL tests still pass.

## Outstanding product gates

This is a snapshot freshness **advisory**, not verified factual relevance,
an anti-prompt-injection model benchmark, consent to run, a future-state
transactional lock, OCR, embedding search or a model inference pipeline.
The final decision service must revalidate cited source commitments *inside
its final decision transaction* before accepting an outcome; this service
alone does not accomplish that. External cache deletion and signature-key
rotation, full backend TypeScript, first-agent Windows, real browser and
complete B4/B5/B6/release remain open.

Private repo; GitHub Actions disabled; main untouched; no merge, public
publishing, paid provider, model API or customer file access. **NO-GO.**

## Latest-head actual local app acceptance

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
**PASS, exit 0** on Mac: Bostan's private-local HTTP health, isolated real
PostgreSQL initialization, synthetic company INSERT, first clean stop,
restart with exact persisted company, second clean stop and safe temporary
QA profile cleanup. `git diff --check`: PASS. The app smoke does not verify
factual answer quality or external side effects.
