# B4-05 — Revalidate reviewing human's task-document privacy at final board claim

**Private development, 2026-10-25. No deploy, merge, publish or paid provider.**

## The concrete authorization gap

B4-04 already validated the submitted document version/identity, and
rechecked source bytes/revision under canonical `FOR SHARE` locks at final
B2 board decision commit. However, that locked query used a hardcoded
`issueReadCondition: true`: it would check the *agent's previously valid*
citation without verifying that the **human now deciding** can currently
read the linked task. A source could be moved to a private owner after the
proposal while leaving the original issue title, description and
`updated_at` unchanged, so the B2 issue-snapshot HMAC would still match.

## Source-first change

B4-05 reuses the existing, canonical
`issueReadSqlCondition(db, reviewingActor)` and the same B2 decision service.
At a **positive human board decision**, the authorized human board actor is
passed into `isBostanRecommendationFresh` inside the existing locked SQL
transaction. The reviewer-specific live task privacy SQL is pushed into
every canonical document join; non-board actors cannot satisfy the document
source check. A denied or revoked source fails with the existing
`bostan_recommendation_stale` conflict (409), leaving the open decision and
zero external effects. The existing read-only
`GET /decisions/:id/bostan-freshness` now supplies the real requesting board
actor rather than an implicit unrestricted source read, so the UI also
stops presenting the private document as current.

Original issue-only B2 recommendations remain compatible. Safe `defer` or
`request_evidence` choices remain inert; malformed Bostan effectful options
are still blocked by the original B2 canonical decision service. Explicit
local instance-admin access follows its existing authorized source policy;
B4-05 does not invent a different admin grant system.

The source body, privacy-owner identifiers, actual private financial policy
or HMAC do not appear in the status response. No new index, schema, task
writer, token, daemon, action dispatcher or external provider was created.

## Real PostgreSQL / HTTP / decision acceptance

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-evidence-recommendations.test.ts src/__tests__/bostan-knowledge-evidence.test.ts --maxWorkers=1`

**34/34 PASS, 0 failed/skipped** on a newly initialized synthetic local
PostgreSQL database, real HTTP board freshness route and original decision
service. The B4-05 adversarial scenario:

1. Create a legitimate, authorized Bostan recommendation with an actual
   linked document and known current source fingerprint.
2. Transition its original source issue from public to a private owner who
   is *not* the human reviewer, while retaining the **exact same original
   issue updated timestamp, title and description**.
3. Confirm that the source status endpoint reports false and the existing
   decision service rejects positive board acceptance with HTTP 409.
4. Confirm the decision remains open and there are zero external effect
   execution records; human can still safely defer the outdated advice.

All original B2 signed budgets and board decision tests, and B4-01..04
source privacy, revisions and multi-citation tests remain passing.

## Outstanding gates

This is current **reviewer document read authorization** and snapshot
integrity, NOT factual relevance evaluation, robust adversarial
prompt-injection filtering, remote provider state confirmation, model quality
or a complete release. Stale memberships/session revocation depend on the
canonical auth/session layer and still require full installed/browser E2E.
Full server TypeScript on the small Mac has not been qualified (previous
bounded compilation timed out). Windows first-agent, B4 analytics/OCR,
B5 automated end-to-end team handoff, B6 packaging/release and external
effect verification remain open. Repo private, inherited Actions disabled,
main unchanged. **NO-GO.**

## Latest-head real local application smoke

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0** on Mac. Verified private HTTP health, clean isolated
PostgreSQL initialization, synthetic company INSERT, first graceful stop,
restart with exact persisted company, second graceful stop, and disposable
HOME cleanup. This is a real app persistence smoke, not a Windows installed
app or browser first-agent product acceptance. `git diff --check`: PASS.
