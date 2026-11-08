# B4-01 — Versioned, company-scoped knowledge citations from real task documents

**Private development only, 2026-10-24. Read-only provenance, not autonomous retrieval.**

## Copy-first approach

The source already has canonical `documents` + `issue_documents`, task
privacy authorization and `company-search` query infrastructure. B4-01
reuses them and **does not** introduce a second document index, duplicate
retrieval memory, task author or evidence database.

Board-only:

`GET /api/companies/:companyId/issues/:issueId/bostan-evidence/documents/:documentId`

- Requires an authenticated board member with access to the path's company
  and a separate `company_scope:read` authorization verdict. It also
  applies `issueReadSqlCondition(db, req.actor)` in the actual PostgreSQL
  document join, so the company gate cannot bypass task-level privacy.
- Requires the document to still be **linked to exactly that live, visible
  issue** through `issue_documents` and to belong to the same company as
  both the issue and the document. Hidden/harness issues do not produce
  source evidence. Unlinked or deleted documents return 404 immediately,
  without stale cached snippets or background document copies.
- Returns citation coordinates (company, issue, document, document key),
  current revision ID/number and timestamp, trust metadata from the source,
  and a **bounded 1200-character** excerpt. No cross-tenant fallback.
- Creates a private, domain-separated HMAC-SHA256 fingerprint over the
  original company/issue/document binding, title, format, **entire** current
  source body and revision/timestamp. Editing source text or changing its
  revision invalidates the previous snapshot fingerprint; downstream
  consumers must refresh instead of assuming previous citations remain valid.
- Explicitly labels document text **untrusted source data**, with
  `factualRelevanceVerified:false` and `executionAuthorized:false`.
  Provenance confirms an actual database/source relationship, not the truth
  of any claims in the content or permission to obey embedded instructions.
- No paid OCR, embedding model, LLM, external API, file upload or search
  index is started by this route.

## Executed real Mac PostgreSQL and HTTP tests

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-knowledge-evidence.test.ts --maxWorkers=1`

**3/3 PASS, zero skipped/failing cases**, each covering several real SQL and
Express route scenarios:

1. Exact linked source version and title/provenance are returned to an
   authorized board. Actual document body/revision mutation produces a new
   private HMAC and updated excerpt; the old full source content is no
   longer projected. An explicit false `issueReadSqlCondition` returns no
   source even within the correct company.
2. Other-company normal board sessions cannot retrieve the source; an
   agent attempting the board-only route receives 403; wrong document UUID
   returns 404. Unlinking the issue-document relationship and deleting the
   document each revoke retrieval immediately.
3. A 12K-character source returns at most 1200 characters, flagged as
   truncated, and hiding the original issue makes the source inaccessible.

The imported local implicit admin retains its **designed** instance-level
company access. Cross-company denial was intentionally tested using an
ordinary session-board actor with a different company's membership, not an
administrator impersonation.

## Still open

- This is a **known-ID source read model**, not a new general search engine,
  OCR, citations-in-recommendations workflow, embedding retrieval, verified
  answer relevance, deletion propagation to model-provider caches or a
  prompt-injection model safety benchmark. Those remain B4 work.
- The cited document can change after this read. A future consumer must
  revalidate revision/content snapshots when accepting a decision.
- Full server TypeScript compile, Windows first-agent E2E, browser UI,
  external side-effect verification and B4–B6 remain unqualified.
- Private GitHub, Actions disabled, main unchanged, no public deployment,
  release, merge or paid model. **NO-GO.**

## Latest-head real local source application acceptance

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0** on macOS after this B4-01 implementation. The application
initialized isolated PostgreSQL and private localhost HTTP, inserted a
synthetic company, performed two verified graceful stops around a restart,
and retrieved the exact persisted company between stops. The successful
disposable test HOME was cleaned. `git diff --check` PASS. This acceptance
does not substitute for a real installed Windows or browser-agent journey.
