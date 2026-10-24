# B3-03 — Persist a private, tamper-evident host file-readback receipt

**Private source-only development, October 24, 2026. No external tool authority.**

## What is actually recorded

B3-02a opens one local file independently under a company-scoped workspace,
compares exact bytes and SHA-256, and deliberately does not attribute file
changes to the origin tool. B3-03 makes each such host readback durable.
Rather than introduce a second action ledger, the service reuses the
existing authoritative `workspace_operations` table with
`phase=bostan_local_artifact_readback`. It also reuses Bostan's private
`decision-signing` key and the exact inherited company/issue/workspace and
tool-invocation scoping.

For each **authorized human board** request that qualifies through B3-02a,
Bostan performs a new actual confined-file read, then inserts one host-owned
workspace operation describing the observed status, exact owner IDs,
observation time and a private HMAC-SHA256 request binding. The returned
`receiptId` is a durable UUID. The canonical receipt fields have a second
independent, domain-separated HMAC-SHA256 signature using the private
server signing key; the database cannot silently change signed claims
without invalidating the signature.

`POST /api/tool-gateway/bostan-local-file-readback` now stores a receipt and
returns its ID. Review through:

`GET /api/tool-gateway/bostan-local-file-readback/:receiptId?companyId=<uuid>`

Both routes require an authenticated board actor with the existing
`tools:view_audit` **and** `tools:manage_runtime` privileges, and company
scope. The GET returns only whether the receipt signature and database row
binding remain valid, the historical readback state and recorded timestamp.
It returns **no raw file contents, relative/absolute paths, raw expected
SHA-256, output strings, keys or financial data**.

The imported PostgreSQL privacy hook adds `_runPrivacySources` and
`_issuePrivacySources` metadata automatically. These two **DB-managed**
provenance fields are not part of the signed receipt authority and must not
break signature verification. Any other extra metadata key is refused, as
are altered receipt fields, status/issue/workspace ownership and HMAC.

## Crucial limits

- `receiptIntegrityValid:true` proves Bostan's own host-generated record
  has not been altered under the current private signing key. It does
  **not** prove that any remote action succeeded or who edited a file.
- `contentReadbackMatched:true` confirms the file matched a board-supplied
  expected hash at one observation time; a file may have existed in that
  state before the tool call and may change after the recorded observation.
- Every receipt keeps `independentEffectVerified:false` and
  `autoRetrySafe:false`. There is NO execution, no remote provider readback,
  no automatic retry, no model inference, and no new task/run writer here.
- Signing key rotation without retaining prior keys makes old receipts
  unverifiable. Controlled key versioning and historical verification are
  still needed before long-term audit archival can be called qualified.
- Repeated board POSTs create separate read-only observations and receipt
  rows; no claim of an idempotent deduplication contract is made.
- Latest whole-server TypeScript, native Windows readback, browser E2E,
  independent before/after action attribution, and B3–B6 remain open.

## Mac executed SQL, HTTP, and real filesystem tests

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-action-evidence-status.test.ts --maxWorkers=1`

**9/9 PASS, zero failures/skips**: the inherited B3-01 classifiers and
B3-02 real file/SQL tests remain green, and the SQL+HTTP acceptance now
checks a durable receipt's signature on readback, privacy redaction,
DB-managed privacy metadata, deliberate metadata-state tampering,
additional unexpected metadata, tenant isolation, agent denial and a
historically valid mismatched-content receipt. Fake signatures cannot be
asserted as valid. All DB rows and actual files are synthetic local QA.

Full source-runtime restart acceptance is a separate gate, to be appended
following the actual Mac run. Repo private, Actions disabled, main untouched,
no release/merge/cloud deployment or paid service. **NO-GO.**

## Latest-head real source application acceptance

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0** on macOS after B3-03. Verified a new isolated private-local
PostgreSQL server, private `/api/health`, synthetic company create, clean
shutdown, application restart with exact persisted company readback and a
second clean stop. The disposable successful test HOME was cleaned; no live
models, paid providers or external automation were used. `git diff --check`:
PASS. This is not a browser or installed Windows acceptance test.
