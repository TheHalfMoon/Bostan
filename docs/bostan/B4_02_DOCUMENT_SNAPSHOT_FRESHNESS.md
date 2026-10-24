# B4-02 — Check current document source snapshots without repeating or trusting stale citations

**Private, development-only, October 24 2026. No release, external actions or paid providers.**

## Gap closed

B4-01 exposes a company/issue/document-linked, versioned citation and a
private HMAC that binds the actual source body, revision, source metadata and
origin task. A later board read must not interpret that historical snapshot
as a guarantee of current document content. B4-02 adds a narrow **read-only
freshness check** using the existing B4-01 canonical source reader, rather
than creating a second evidence store, index, task authority or background
verification daemon.

`POST /api/companies/:companyId/issues/:issueId/bostan-evidence/documents/:documentId/freshness`

The body contains only `expectedSnapshotHmacSha256` as 64 lowercase hex
characters; unexpected keys and malformed IDs are rejected. The private
commitment is in a POST body rather than a URL/query string. The request
requires a **board actor**, authorized company membership,
`company_scope:read` and the actual current `issueReadSqlCondition` within
the canonical document join. It re-reads the **current entire source body**,
revision and bindings, recomputes the private HMAC and compares it using a
constant-time digest comparison.

A currently accessible but changed document returns `snapshotCurrent:false`;
a source that is hidden, deleted, detached from the task or unreadable under
the issue privacy condition returns 404. No current/historical document
contents, titles, expected/current HMAC values, credentials, tool outputs or
internal secrets are returned in the freshness response. The response has a
`Cache-Control: no-store` header and says explicitly
`decisionCommitAuthorized:false`, `factualRelevanceVerified:false`, and
`sourceContentIsUntrusted:true`.

The freshness verdict is a point-in-time advisory. No action, model call,
board choice, financial approval or remote provider is executed. Any later
positive decision must still re-verify its sources inside its own final
protected transaction. Signing-key rotation can invalidate historical
fingerprints unless prior keys are retained; future key-versioning remains.

## Real PostgreSQL and HTTP evidence

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-knowledge-evidence.test.ts --maxWorkers=1`

**5/5 PASS, 0 FAIL/SKIP** on macOS with a disposable real PostgreSQL cluster,
Express routes and actual document mutations. Covers valid snapshot, changed
body/revision, random commitment, strict payload, `no-store`, redacted
response, authorized board vs normal foreign-company board/agent isolation,
unlink denial, explicit denied issue-read condition and hidden-source denial.
The original B4-01 tests for deletion, edits and bounded excerpts remain green.

## Still unqualified

This is not factual relevance verification, prompt-injection-proof reasoning,
OCR/semantic retrieval, independent signed before/after tool attribution,
external cache deletion, full server TypeScript, Windows or Chromium product
acceptance. B4, B5, B6 and release are not complete. Repo private, Actions
disabled, main unchanged, no merge/deploy/release. **NO-GO.**

## Latest-head actual source runtime smoke

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
**PASS, exit 0** on macOS. Private localhost HTTP health, newly initialized
isolated PostgreSQL, synthetic company creation, first clean stop, restart
with exact company persisted, and second clean stop. Successful disposable
test HOME removed. `git diff --check` PASS. This does not qualify a Windows
installer or a real browser-agent end-to-end journey.
