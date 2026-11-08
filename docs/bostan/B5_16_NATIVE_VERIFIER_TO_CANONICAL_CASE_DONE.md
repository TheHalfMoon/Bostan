# B5-16 — Native reviewer report to governed source Issue/Case Done

Private Bostan development, October 25 2026. No merge, release, publish, deploy, paid provider or Actions.

## Deterministic end-to-end product contract

B5-14 and B5-15 qualified real source Native Runner first-party JWT tool transport for a *scoped* independent reviewer to GET current B4 source HMAC over `call_api` and PUT strict JSON report over `write_task_document`, both through actual localhost Express source authentication and isolated PostgreSQL. B5-16 now extends that exact synthetic run and persisted report to the **original canonical case handoff + Issue Done transaction**, rather than stopping at saved report JSON:

1. Original synthetic company, distinct specialist and reviewer, canonical Case, task, delivered independent verification handoff, native running reviewer and current source document exist in isolated PostgreSQL. Signed per-company/per-instance JWT from Native Runner performs GET current source HMAC and PUT report; original authenticated revision contains actual reviewer and run IDs.
2. Test source runtime transitions that exact native review run to `succeeded`; any further native write is refused. An attempted direct `issueService.update({status:done})` **fails** HTTP 409 `bostan_case_terminal_handoff_required`, with Issue/Case not closed.
3. Original `caseHandoffService.handoff({to:done})` checks the delivered, distinct-agent review, successful run, strict latest agent-authored JSON, **current HMAC citations**, accepted expected task/case versions, then creates the inert original `awaiting_completion` terminal intent. No external effect is authorized.
4. Original `issueService.update({status:done})` revalidates same canonical B5 evidence at final locked transaction boundary, closes Issue **and** Case and marks original case handoff `completed`. No forged completion claim or second case/task owner.

## Executed tests

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-verifier-native-runner-e2e.test.ts src/__tests__/bostan-independent-verifier.test.ts src/__tests__/bostan-knowledge-evidence.test.ts src/__tests__/bostan-case-closure-routes.test.ts src/__tests__/bostan-verifier-runner-bridge-schema.test.ts --maxWorkers=1`

**21/21 PASS**, five files, 0 fails/skips, including 4 full local native signed JWT/HTTP/SQL cases, original verifier sources, immutable review policy and OpenAPI schemas. The synthetic integration validates **platform semantics and route/transaction correctness**, not model inference or factual truth.

## Remaining NO-GO gates

A real, no-cost provider runtime must still execute founder/CEO/specialist/independent verifier decisions, enforce budget and consent, obtain trustworthy readback of real external effects, handle errors/retries/suspension and satisfy product-wide release qualification. Broad B4 knowledge/OCR/analytics, full server TypeScript, Windows/Chromium, B6 offline installers/SBOM/independent QA remain OPEN. Private repository, inherited Actions disabled, main unchanged. NO-GO.

Latest-head local source app: `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs` **PASS, exit 0**, localhost private Bostan HTTP, isolated disposable PostgreSQL, synthetic company creation and clean stop/restart with exact persisted company, second clean stop and temporary profile removal. `git diff --check` PASS.
