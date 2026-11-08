# B1-156 — Repair lexical WebSocket Vitest fixture missing HTTP version

Status: **PRIVATE / ZERO COST / DRAFT / UNMERGED / RELEASE NO-GO**. Parent is private #412 B1-155 at exact commit `b21575066f9ae8adf0a6c4943aef421a4361ace5`. No production code or dependencies changed.

## Root-cause confirmation

B1-154 had correctly tightened private WebSocket upgrade admission to require `req.httpVersion === "1.1"` in `server/src/middleware/private-hostname-guard.ts`. B1-155 subsequently authored three direct Vitest lexical `Connection` token cases by constructing `{ method: "GET", url, rawHeaders }` **without** `httpVersion`. Because the production gate checks version first, those tests exercised protocol metadata refusal instead of the lexical parser. The negative cases would pass for the wrong reason; the expected accepted ASCII-tab OWS case would fail.

This was demonstrated against **the exact production function body** extracted from B1-155 GitHub source blob `7b5b8de7fdb1e29496b128e9586d4584fad4041e` (read-only V8 execution with the downstream Host predicate stubbed true to isolate the header/version boundary):

| Existing lexical case | Before (missing httpVersion) | After (HTTP/1.1) | Expected |
| --- | --- | --- | --- |
| Duplicate keep-alive | false | false | false |
| Latin-1 NBSP | false | false | false |
| Valid ASCII tab OWS | **false (wrong)** | **true** | true |

## Minimal fix

The B1-155 Vitest table now constructs requests by spreading its existing canonical `makeRequest("GET")` fixture, which already contains `httpVersion: "1.1"`, and overrides only rawHeaders for each lexical case. No change to the production gate, HTTP version policy, negative cases, public exposure, WebSocket authorization, or other tests.

## Evidence and release limits

The exact production gate body and exact canonical `makeRequest` function from GitHub were executed under isolated V8 with stub Host admission; all **3/3** lexical expectations are satisfied after the fixture repair, vs **2/3** before. The changed test blob was re-read from the GitHub private branch and verified to use `...makeRequest("GET")`. This is **not a full native Node>=24.11 Bostan source checkout or Vitest/Supertest run**; complete 35 authored native-wire cases, TypeScript7, rootless bwrap and native Windows PostgreSQL/HTTP qualification remain unrun or blocked. Issue #234 and #237 remain OPEN. No deployment, publication, main-merge, Actions, paid provider, or customer-data change. **RELEASE NO-GO**.
