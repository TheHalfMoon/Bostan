# B5-15 — Native reviewer can read canonical task-scoped B4 source digest

Private Bostan development, October 25 2026. No merge, deployment, publish, release, paid AI or GitHub Actions.

## Why B5-14 alone was insufficient

B5-14 exercised real Native Runner signed JWT, source `actorMiddleware`, live local HTTP, actual original report JSON write and Postgres provenance/replay receipts. But the B5-06 **agent-scoped read** of the current source HMAC existed only as an unregistered backend REST path. Native Runner `call_api` works through the server-derived OpenAPI catalog: an unregistered source-digest GET cannot be discovered or invoked by a model, so the reviewer could not obtain a current HMAC needed to *author* the report autonomously.

## Copy-first fix

Register the original read-only route in OpenAPI as:
`GET /api/companies/{companyId}/issues/{issueId}/bostan-verification/sources/{documentId}/snapshot`

It has path UUID constraints and explicit contract: only an active same-company, same-task, *currently assigned* independent reviewer with an original actually delivered distinct-agent verification handoff can obtain the source revision and opaque HMAC. Original `issueRoutes` still enforces all run/delivery, privacy and phase checks. It returns no raw source body, title, signing key or tool consent, and does not widen public person/board access. The Runner `call_api` catalog now discovers the exact operation, with existing standard-run API tool permission.

## Qualified live local Native Runner sequence

New B5-15 case in the B5-14 actual native integration test calls
`PaperclipRunnerToolAuthority.execute({tool:'call_api',arguments:{operationId: GET...,pathParams:{companyId,issueId,documentId}}})`. This uses the actual source-bound active Native Runner, signed per-company JWT, original authenticated HTTP middleware, source scoped digest REST route and isolated real Postgres. Response is HTTP 200 and carries the expected actual current source HMAC / schema, **not** source body. The adjacent B5-14 case then writes the matching bounded report JSON over the original Native Runner tool/REST path, stores canonical run attribution, and replays safely. Authenticated HTTP/API provenance, not real model inference, is the claim.

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-verifier-native-runner-e2e.test.ts src/__tests__/bostan-independent-verifier.test.ts src/__tests__/bostan-knowledge-evidence.test.ts src/__tests__/bostan-case-closure-routes.test.ts src/__tests__/bostan-verifier-runner-bridge-schema.test.ts --maxWorkers=1`

**20/20 PASS** across five files, zero skips/fails, original real SQL/HTTP tests plus Native Runner OpenAPI/schema and actual signed JWT local HTTP reads/writes. Temporary HTTP server and disposable PostgreSQL stopped and removed.

## Unfinished gates

A real model must still execute the entire first-run founder→CEO→specialist→verifier case, meaningfully judge facts rather than fill synthetic arguments, independently read back third-party effects, obey true consent/budget gates and recover from interruptions. Whole-server TypeScript on enough resources, Windows and Chromium installed E2E, B4 OCR/retrieval/analytics, B6 packaging and all release checks remain open. Source repo private, inherited Actions disabled, main unchanged. NO-GO.

Latest-head local Bostan source-app smoke: `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs` **PASS exit 0**, actual local server, isolated PostgreSQL health/company create, clean stop/restart/exact persistence/second clean stop; disposable QA profile removed. `git diff --check` PASS.
