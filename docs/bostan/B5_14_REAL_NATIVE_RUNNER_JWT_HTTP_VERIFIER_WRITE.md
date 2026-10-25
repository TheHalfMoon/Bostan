# B5-14 — Native Runner task-tool → signed JWT → actual local HTTP → source PostgreSQL

**Private Bostan development, October 25 2026. No merge, deployment, publishing, release, cloud cost or model execution.**

## Previous qualification gap

B5-11 established genuine agent-scoped REST report writing in an Express+PostgreSQL integration with manually injected synthetic `req.actor`; B5-12 allowed native `write_task_document(format:json)` and B5-13 corrected OpenAPI. However nobody had qualified the *entire actual first-party native tool call*, its signed run JWT, actor middleware and original source endpoint together.

## Full real native API integration — no model inference

New `bostan-verifier-native-runner-e2e.test.ts` on an isolated **real disposable system PostgreSQL**:

1. Create synthetic company, two distinct real agent rows (specialist and native reviewer), original governed Case, task and original delivered verification handoff. Admit a bound active `heartbeat_runs` with `runtimeMode:native` and native task execution ownership.
2. Launch an **actual local Express HTTP server** on `127.0.0.1` with source `actorMiddleware(db,{deploymentMode:'authenticated'})`, original `issueRoutes`, original error handler. No fake REST dispatcher or pre-populated `req.actor`.
3. Invoke `new PaperclipRunnerToolAuthority(db,binding).execute({tool:'write_task_document',callId,... format:'json',key:'bostan-verification'})`. Native authority validates original bound run/task/agent/permissions, reserves a durable source `apiToolReceipts` record, obtains a **real signed per-company/per-instance JWT**, runs source OpenAPI `validateRunnerApiCall`, sends live HTTP with `Authorization:Bearer` and matching run-id header; original auth middleware validates JWT, loads run/agent identity, original issue routes enforce task/independent verifier/strict review JSON, and original document service persists a new revision.
4. Read **actual** `document_revisions` to prove the authenticated reviewer agent/run authored the saved JSON source and that the result was HTTP 201. Retry the exact same call ID; get the durable cached result and verify **exactly one** revision (no duplicate effect).
5. Reject JSON to non-Bostan document keys before dispatch, with no such document created. Mark the active reviewer run succeeded; subsequent native tool mutation fails the original binding guard. Close the temporary local HTTP server and disposable SQL data.

## Evidence

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-verifier-native-runner-e2e.test.ts src/__tests__/bostan-independent-verifier.test.ts src/__tests__/bostan-knowledge-evidence.test.ts src/__tests__/bostan-case-closure-routes.test.ts src/__tests__/bostan-verifier-runner-bridge-schema.test.ts --maxWorkers=1`

**19/19 PASS**, zero skips/failures, five files. The two new native-to-server tests both PASS; prior SQL/HTTP/reviewer-freshness and native schema/OpenAPI cases remain green. Bounded, no cost, localhost-only; actual signed JWT transport and original auth middleware are in test unlike earlier synthetic actor injection.

## Explicit outstanding work

Native Runner **tool transport and real signed JWT/API authoring are now qualified with a deterministic synthetic invocation**. A REAL language model has **not** generated tool arguments, independently judged any fact, nor completed a founder→CEO→specialist→verifier machine-driven case. Third-party external tool effects, consent, budgets, retries/interruption and independent observable provider readback remain OPEN. Full server-wide TypeScript build, Windows/Chromium installed journeys, B4 OCR/analytics, B5 real model/provider acceptance, B6 packaging and eventual release still need work.

Private repo, inherited GitHub Actions disabled, `main` unchanged. **NO-GO**.

Latest-head source app: `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs` **PASS exit 0**. Actual local Bostan HTTP health, disposable PostgreSQL, synthetic company insert, clean stop/restart with exact company persistence and second clean stop, disposable HOME removed; `git diff --check` PASS.
