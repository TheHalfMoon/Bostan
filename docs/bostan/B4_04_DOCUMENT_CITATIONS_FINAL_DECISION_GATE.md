# B4-04 — Enforce signed document citations at Bostan board-decision commit

**Private source development, October 24 2026; no public release/merge/actions.**

## Integrating B4 provenance into canonical B2 board authority

B2 recommendations already sign/lock a company's cited task evidence and
board-configured budget facts. B4-01–03 added current, company/task-scoped,
revision-bound document citations; separate preview APIs alone are not a
safe final board-acceptance gate. B4-04 integrates those **optional**
document commitments into the existing B2 signed recommendation and the
existing final locked decision transaction. No new decision writer or model
executor is created.

At proposal creation:
- `bostanRecommendationSchema` may include at most 10 distinct
  `evidenceDocuments: [{issueId,documentId,expectedSnapshotHmacSha256}]`.
  Each issue must also be in the cited `evidenceIssueIds`; documents must
  be distinct, IDs valid, and fingerprints strictly lowercase SHA-256.
- Actually fetch each current document from the canonical linked
  issue/document tables with `issueReadSqlCondition` derived from the
  originating agent's authorization, enforce company and task visibility,
  and compare the user-supplied private source fingerprint. An absent,
  hidden, unlinked, foreign or changed source is rejected BEFORE saving
  any new advice; references supplied by a model cannot forge provenance.
- Store only sorted bound IDs and opaque source snapshot HMACs, not raw
  source bodies, document titles or credentials. Metadata counts are
  explicit and provenance/factual relevance stays `false`.
- Preexisting B2 advice without document citations continues to work;
  creating a recommendation still does not authorize tool effects or spend.

When the human board chooses a **positive** option:
- B2-05 already locks the open decision row, rechecks canonical issue
  evidence and financial policy, and requires all Bostan options to have
  `effects:[]`. Within that SAME transaction, B4-04 additionally verifies
  the complete signed document reference list, its membership in the
  original cited issues, no duplicate, valid count/IDs/fingerprints and
  matching current canonical source content and revision.
- The source SQL uses `FOR SHARE` locks on the canonical document/issue/link
  rows in the board-claim transaction to prevent concurrent writes to
  those rows between document read and board claim. Changed/detached/
  inaccessible content refuses positive decision as
  `bostan_recommendation_stale` (HTTP 409); the decision stays open and
  no effects are dispatched.
- Safe `defer` and `request_evidence` choices remain available even after
  evidence changes, but malformed executable Bostan option effects are
  still rejected for ALL choices by the canonical decision service.

This is causal **source version** binding, not independently established
relevance or trusted assertions. Document text is untrusted and cannot
authorize external actions. There is no new table, task creation, model
permission or retrieval index.

## Actual Mac SQL and service integration

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-evidence-recommendations.test.ts src/__tests__/bostan-knowledge-evidence.test.ts --maxWorkers=1`

**33/33 PASS, zero failures/skips** across two test files and isolated real
PostgreSQL. B4-04 assertions cover:
- Valid linked current document accepted as a **non-executing** human board
  decision; zero `decision_effect_executions` rows even for a positive choice.
- Subsequent mutation of a document without changing its parent task:
  creating an advice with an old reference fails, and the previously
  signed open recommendation fails at final human positive choice (409)
  while preserving the open decision and zero effects.
- Human operator can still explicitly defer the outdated recommendation.
- Unknown, unlinked or foreign/uncited documents and duplicate references
  are rejected before saving a decision; raw source text is not published
  into signed decision metadata.
- The original B2 budget, idempotency, evidence and board-gateway tests,
  and all B4-01–03 source-snapshot/tenant/revision tests remain passing.

## Remaining gates

- Actual calibrated model accuracy, factual relevance/entailment of cited
  documents and injection-resistant tool planning have **not** been proven.
- Board-specific document access revocation after the original agent read
  needs additional user/actor authorization design; this wave revalidates
  current canonical company+visible issue+document and signed owner, not an
  external identity-provider ACL readback.
- Transaction guards do not authorize spend, remote execution or retries.
- Full server TypeScript, Windows agent + installer, real Chromium journeys,
  external side-effect reconciliation, B4–B6 and release remain unqualified.
- Private repo, Actions disabled, main unchanged. No merge, deployment,
  publication or paid provider. **NO-GO.**

## Latest-head actual source application smoke

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
**PASS, exit 0** on macOS. New synthetic private local PostgreSQL and
loopback HTTP health, company insert, graceful shutdown, restart with exact
company persistence and second graceful shutdown. Disposable HOME and
local test cluster removed. `git diff --check` PASS. This is neither a
whole-server TypeScript qualification nor a Windows/browser product run.
