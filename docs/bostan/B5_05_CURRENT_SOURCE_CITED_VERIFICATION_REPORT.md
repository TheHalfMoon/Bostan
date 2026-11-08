# B5-05 — Bind independent reviewer sign-off to current canonical B4 source snapshots

**Private Bostan development, October 25 2026. DO NOT MERGE/DEPLOY/PUBLISH/RELEASE.**

## Why B5-04 was incomplete

B5-04 required an opt-in case's current `bostan-verification` document to have
current latest revision provenance from a distinct agent's successful task
run after the verified handoff. A report claiming "looks good" without a
reference to what was actually reviewed still could not establish relevant
source provenance. B5-05 requires the report to carry version-bound,
authenticated B4 citation fingerprints for real sources on the same task.

## New strictly bounded format

`documents.format = 'json'`, issue-document key `bostan-verification`,
body a JSON object with the **exact** schema:

```json
{
  "schema": "bostan.verification.report.v1",
  "verdict": "pass",
  "summary": "Independent reviewer assessed the cited task-source document and its current revision.",
  "sources": [
    {
      "documentId": "00000000-0000-4000-8000-000000000001",
      "expectedSnapshotHmacSha256": "<64 lowercase hexadecimal characters>"
    }
  ]
}
```

This is a field-format example only. A real agent must read the actual
canonical source's current opaque HMAC, not copy the placeholder digest.
The string `verdict:pass` is the *reviewer's claim*, NOT an independently
established fact, consent to act, financial authorization, a cryptographic
signature by a trusted third party, or proof of a remote provider result.

- Exact, strict no-extra-field Zod schema; `verdict:pass`, 40–3000-character
  nonblank summary, and 1–10 unique source-document UUIDs and lowercase
  SHA-256 HMAC commitments. Empty, malformed, duplicate, self-citation,
  non-JSON or arbitrarily verbose reports fail closed.
- At the **original case terminal acceptance transaction**, Bostan retains
  B5-01..04 independent verified handoff, live assigned reviewer, canonical
  successfully finished task run, and current verifier-owned report
  revision. It now additionally calls the **existing B4 canonical task-linked
  document snapshot freshness logic**, under `FOR SHARE`, for every cited
  document, with the case's exact company/work issue and strict privacy
  source join.
- Deleted/unlinked/hidden/edited/reversioned sources do not match the
  original HMAC. Any missing/stale citation returns 409
  `bostan_verifier_source_stale`, leaving case/task unchanged. Malformed
  report fails 409 `bostan_verifier_report_invalid`. Nothing is dispatched.
- The source/report body is never echoed or copied into a second knowledge
  index or untrusted task command. No schema migration, new model or
  external API required for the verification gate.

## Actual Mac tests

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts --maxWorkers=1`
**3/3 PASS**, zero failed/skipped, real isolated PostgreSQL and original
case/document source services. Synthetic team creates a *real* linked
implementation document and obtains its B4 HMAC through the original
read-only source service. A current, correctly attributed reviewer-run JSON
report links to that source. Editing the implementation document *after*
the successful reviewer run causes `bostan_verifier_source_stale`. A later
fresh reviewer run with the updated HMAC and current JSON report permits
only the original **effect-free** `awaiting_completion` intent. The test
also rejects self-verification and an implementer rewriting the latest
reviewer-owned report. No paid/provider model or remote action was used.

`pnpm --filter @paperclipai/ui exec vitest run src/pages/CaseDetail.test.tsx --maxWorkers=2`: **14/14 PASS**.
UI TypeScript `tsc -b` and `CI=1 pnpm --filter @paperclipai/ui build`: **PASS**.
The case's read-only details explain that closure requires a current
review report citing unchanged source documents. Build retains inherited
nonfatal JavaScript chunk-size warnings.

## Outstanding gates

- The board-only B4 citation-fingerprint read path does not yet let an
  authenticated verifier agent obtain its assigned task's current citation
  HMAC without using an internal service. Implement a strictly-scoped
  agent-read surface with current run identity, task assignment and
  task/document privacy before claiming the full product workflow works.
- Factual correctness/semantic entailment, model-authored content security,
  third-party approval, independently observed file/provider state,
  signed verdict receipts and actual AI/team runtime are not proven.
- Full server TypeScript remains resource-blocked on the shared Mac;
  Windows first-agent, browser E2E, B4/OCR/analytics, B5 total company
  acceptance and B6 preparation remain open. No publish or merge.

Repository private; inherited GitHub Actions disabled; `main` unchanged.
**NO-GO.**

## Latest-head real local Bostan smoke

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0**. Verified macOS private localhost HTTP health, isolated
PostgreSQL initialization, synthetic company INSERT, clean stop/restart with
exact persisted company and second clean stop. Disposable test HOME removed.
The offline server-test dependency cache was reused with zero downloaded
packages. Missing UI cache inputs were restored from locked public npm
registry packages (no paid provider and no install scripts). Source control
is clean after committing this branch; `git diff --check` PASS.
