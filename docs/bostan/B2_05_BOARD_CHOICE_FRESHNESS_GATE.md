# B2-05 — Revalidate the advisory recommendation before a human board choice

**Private development, Oct 24, 2026. No paid services, merge, publication or release.**

## Closing the time-of-check/time-of-use gap

The B2-01..04 recommendation writer verifies the cited evidence, company/agent/
project budget exposure, and content/version HMAC when **creating** advice.
The imported board decision service previously accepted any later board choice
on that open record without revalidating those original source snapshots.
A document edit or budget reduction could therefore leave a formally accepted
recommendation based on obsolete evidence or available funds, even though this
particular recommendation authorizes no automatic effects.

## B2-05 design

- The authoritative `decisionService.decide` now recognizes only the exact
  `bostan.decision_recommendation.v1` rule key. Other inherited decision flows
  are unchanged.
- For a positive/alternative board choice, acquire a row lock on the open
  decision inside a PostgreSQL transaction before claiming it decided.
  Invoke the new narrow `bostan-recommendation-freshness.ts` checker inside
  that transaction before projecting `decided`.
- The checker derives issue versions from the original cited UUIDs and the
  origin run's **company-scoped** task, uses `FOR SHARE` locks on evidence
  and origin issues and current applicable board budget policies, recomputes
  both domain-separated HMAC snapshots with the private decision-signing key,
  and rejects if either differs or required provenance metadata is missing.
- Reject obsolete positive advice with HTTP 409 and the stable
  `bostan_recommendation_stale` code; the human can request fresh advice.
  **No choice or effects are persisted by this failed transaction.**
- Preserve human agency to `defer`, `request_evidence`, or explicitly dismiss
  an obsolete recommendation; these are permitted safe decisions with no
  executable effects. For every B2 option, the actual writer always stores
  `effects:[]`, and a mismatched rule-key decision containing effects fails
  closed under this gate.
- Extracted checker into its own service to avoid circular dependency between
  imported `decisions` and B2 recommendation creation modules. No new
  model writer, DB schema, finance ledger, tool gateway or action scheduler.

## Limitations

- Database locks protect the observed issue versions and existing budget
  policy rows through the claim. They do NOT turn advice into a monetary
  reservation, prevent a fresh ledger charge immediately after the check,
  or prove citations semantically support a conclusion. Providers must
  still pass the existing independent budget and action authorization gate.
- This B2-05 path is not a browser UI workflow, real trained-model benchmark
  or independent verification of external effects. B2-B6 remain open.
- Full whole-project TypeScript has repeatedly timed out on Mac in prior
  B1/B2 waves; successful isolated SQL tests are not a full typecheck.

## Executed verification

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-evidence-recommendations.test.ts --maxWorkers=1`

Three new PostgreSQL tests validate: board positive choice denied if evidence
changes after proposal; board positive choice denied if a budget is reduced;
and explicit non-effectful board deferral remains possible after evidence
changes. Existing HTTP access, tenant isolation, signed human board decisions,
source HMACs and budget accounting regressions are run together.

Final test and source runtime receipts are appended after execution.

## Final executed macOS evidence

- B2 cumulative recommendation DB + HTTP tests on the latest B2-05 code:
  **21/21 PASS**, zero failures/skips. Includes 19 actual PostgreSQL/service/
  Supertest cases plus 2 strict schema tests.
- The added hardening test constructs an explicitly signed but malformed Bostan
  advice decision with executable effects and then chooses `defer`; the board
  service rejects the record even on the safe-choice path (HTTP 403), leaves
  the decision `open` and records **zero** executed effects. This proves a
  safe option ID is not a bypass for malformed B2 signed data.
- The full latest-head source runtime smoke on macOS:
  `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
  **PASS, exit 0**. Private HTTP health, actual PostgreSQL company insert,
  graceful stop, restart with exact persistence, second clean stop and test
  profile cleanup. No real model or external provider execution.
- `git diff --check`: PASS. **Latest full-server TypeScript is NOT
  QUALIFIED**: earlier bounded whole-project `tsc` repeatedly timed out,
  and this wave did not claim a successful complete compile. Dedicated
  compiler-performance qualification remains an explicit blocker.
