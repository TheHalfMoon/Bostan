# B2-06 — Private board-only advisory freshness status

**Development-only, Oct 24 2026. No publication, merge, deployment or paid services.**

## Board UX gap

B2-05 blocks stale positive decisions at the final authoritative SQL claim.
Without a preview, the human board would learn that an evidence or budget
snapshot changed only after attempting a choice. B2-06 gives the human an
explicit, non-executing read-only status to support safe review.

## Endpoint

`GET /api/decisions/:id/bostan-freshness`

- Calls the **existing** company-scoped decision lookup, with an explicit
  authenticated **board** actor check before any private budget analysis.
  Agent requests get HTTP 403; foreign-company board actors cannot see the
  decision. Non-Bostan records are not reinterpreted as Bostan advice.
- Reuses the narrow private `isBostanRecommendationFresh` service from
  B2-05 (actual evidence content/version and applicable board budget
  snapshot readback), rather than creating a parallel freshness rule.
- Returns ONLY `decisionId`, current decision status, boolean `current`,
  boolean `positiveChoiceAllowed`, enumerated non-effectful available
  `defer`/`request_evidence` options, and an always-false
  `authoritativeExecutionAllowed`. No company balances, policy IDs, policy
  amounts, HMACs, source document bodies, or model secrets appear in the
  response.
- `positiveChoiceAllowed` is an **advisory** flag. The final B2-05 board
  `POST /decisions/:id/decide` *independently* revalidates freshness inside
  a locked transaction; this GET cannot authorize a spend or connector call.
- For terminal decisions, positiveChoiceAllowed and current are false.

## Executed tests

Mac real synthetic isolated PostgreSQL and actual HTTP router via Supertest:

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-evidence-recommendations.test.ts --maxWorkers=1`

- **23/23 PASS, zero FAIL/SKIP:** 21 real service/SQL/HTTP cases and 2 strict
  schema cases.
- Two B2-06 cases prove authorized board sees current=true on fresh advice
  but false after an actual cited-issue content mutation; no finance figures
  or HMAC are returned; an agent is denied HTTP 403 and an unrelated
  company's board actor cannot inspect the result.
- All B2-01..05 regressions remain passing, including board-positive-choice
  rejection on stale snapshots, budget ceiling/ledger admission advice,
  no-effect commands, idempotency invalidation and signature verification.

## Remaining product gates

The board UI has not yet been wired to visually display this status; the
endpoint is qualified using the real source router and PostgreSQL only.
Full server TypeScript remains unqualified after repeated Mac bounded
compiler timeouts in previous waves. Real browser and agent end-to-end,
independently validated citation relevance, B3 Action Fabric, B4 Knowledge,
B5 multi-agent founder workflow and B6 consumer readiness are still open.
No public release or GitHub Actions; repo private and main unchanged.
**Release NO-GO.**

## Latest-head local application receipt

The actual macOS Bostan source runtime after the new board route was added
passed `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
with exit code 0: private local health, synthetic company create in real
PostgreSQL, first clean stop, restart with exact saved company, second clean
stop, ephemeral test profile cleanup. `git diff --check` PASS. Full
application/browser product acceptance and complete server TypeScript are
not claimed by this receipt.
