# B5-10 — Board-readable current independent-review summary

**Private Bostan development, October 25 2026 — no merge, publish, deploy, release, or paid model.**

## New founder/board review surface

The original Case page described *requirements* for opt-in independent
verification but did not show the actual reviewer report or whether its
cited source documents were still current. This made the user rely on an
opaque JSON task document or an otherwise misleading historical Case Done
state. B5-10 reuses the existing canonical B5-02..09 verifier rather than
reimplementing report/citation logic.

### Authenticated read-only API

`GET /api/cases/:id/bostan-verification`

- Requires original Cases feature gate, an authenticated **board** actor and
  original current `assertCaseAccess` including company/retained-source
  permissions. Agents are rejected 403; foreign-company board actors are
  denied. Opt-out Cases or those without primary work tasks return 404.
- Works in an isolated database read transaction, reading the actual
  same-company Issue/Case records; recognizes an original latest pending or
  completed Case terminal intent and follows the preceding delivered
  distinct-agent reviewer handoff.
- Reinvokes `assertBostanCurrentVerificationEvidence`, including source
  HMAC freshness under `FOR SHARE`, successful reviewer runtime, latest
  canonical reviewer-authored document/revision, strict bounded JSON and
  immutable agent/run provenance. If any of those checks fail with a
  reviewed-state conflict, returns `current:false` and no report summary,
  never a stale confidence indicator or raw source excerpt.
- Returns `schema:bostan.verification.board-summary.v1`, `caseId`,
  `caseStatus`, `provenanceCurrent`, bounded reviewer-authored
  `reportSummary` only when current, `citedDocumentCount`, review IDs,
  and explicit `factualRelevanceVerified:false`,
  `sourceContentIsUntrusted:true`, `executionAuthorized:false`.
  Response uses `Cache-Control: private, no-store`. Neither full source
  content, B4 HMAC nor signing key is returned.

### UI integration

CaseDetail uses a dedicated read-only React Query for opted-in cases with a
work task. It renders the current reviewer claim in a plain escaped text
node (not interpreted as HTML or instruction), the number of current
citations and explicit text distinguishing reviewer-authored claims from
provenance/factual proof. If stale or absent, it instead shows a clear
"no current independent reviewer report" state, including when the Case
had previously reached Done. Cases that did not opt in still make no extra
network request or visible claim.

## Actual tests, 2026-10-25 Mac

- `BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-independent-verifier.test.ts src/__tests__/bostan-knowledge-evidence.test.ts src/__tests__/bostan-case-closure-routes.test.ts --maxWorkers=1`: **14/14 PASS**, actual isolated PostgreSQL/Express/source services.
  A completed distinct reviewer report with current cited source appears to
  the board with exact provenance flags. Reviewer-agent API access fails
  403, foreign-company board access fails 404, and mutating the original
  source *after Case Done* flips currentness to false with summary omitted.
- `pnpm --filter @paperclipai/ui exec vitest run src/pages/CaseDetail.test.tsx --maxWorkers=2`: **16/16 PASS**; verifies conditional current reviewer rendering,
  conservative stale/no-evidence state, bounded text presentation, no
  mutating controls and legacy Case display behavior.
- UI `tsc -b` **PASS**, CI-mode production UI `build` **PASS** with inherited
  nonfatal chunk-size warning. No new paid inference/runtime was used.

## Limits

The plain report is an **agent's claim**. This cannot certify whether the
claim is true, represent signed independent third-party attestation, grant
permission to execute an action, or substitute for external provider or
on-device readback. Real model-run reviewer authoring via public task tools
still needs end-to-end qualification. Full server TypeScript on a suitable
machine, Windows/Chromium, B4 analytics, complete B5 real company journey,
B6 installers and eventual product release remain OPEN. GitHub private,
inherited Actions disabled, main unchanged. **NO-GO**.

## Latest-head local app persistence

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS exit 0** on Mac, actual private-local Bostan HTTP health,
independent disposable PostgreSQL instance, synthetic company creation,
clean shutdown/restart with exact same company and second clean shutdown.
Disposable profile removed. `git diff --check` PASS.
