# B2-04 — HTTP authentication and scope qualification for Decision Fabric

**Private development, Oct 24, 2026. No new production endpoint or permission bypass.**

## Why this matters

B2-01/B2-03 tested the underlying recommendation service with real
PostgreSQL, but a service test alone does not prove the new HTTP route
accepts only properly authenticated agent runs and enforces company
boundaries before reading evidence or writing signed decisions.

B2-04 **reuses the actual imported `decisionRoutes`** (the B2-01 endpoint),
the real Express input validation, normal actor-scoping middleware, error
handler, budget-aware recommendation service and real isolated PostgreSQL.
It deliberately does not invent a new router or mock the authorization
service.

## Executed route E2E cases

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-evidence-recommendations.test.ts --maxWorkers=1`

**17/17 PASS, 0 FAIL/SKIP** including 15 genuine SQL and HTTP integration
cases and 2 strict input schema cases:

1. Agent-authenticated POST with the correct run and company succeeds with
   HTTP 201, persists the signed recommendation with exact source citations
   and returns only alternatives with empty executable effect arrays.
2. A board principal cannot impersonate an agent runner on this POST route:
   HTTP 403, with zero persisted decision rows.
3. Forging the company path to another tenant is rejected with HTTP 403;
   model-supplied effect instructions in an otherwise valid request are
   rejected with HTTP 400. The database remains unchanged in both cases.

All original B2-01–03 regressions continue to pass: company, agent/project
board budget hard-stop checks and ledger exposure; HMAC-protected financial
and evidence snapshots; rejection of stale idempotent recommendations;
company evidence access; declared confidence abstention; and real signed
human choices that have no side effects.

## Remaining qualification

The tests mount the actual API router through Supertest against isolated
PostgreSQL; they are **not** proof of a fully packaged browser/mobile user
interface, OAuth login setup, network edge proxy, model execution, real
external connector, independently verified citation relevance or production
exposure. Whole-project TypeScript and B2–B6 remain open.

Repository private, inherited Actions disabled, `main` unchanged, Draft
stack only. No paid provider, production user data or publication. **NO-GO.**
