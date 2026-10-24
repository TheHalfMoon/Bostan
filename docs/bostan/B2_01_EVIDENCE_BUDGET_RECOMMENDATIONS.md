# B2-01 — Evidence-linked, human-reviewed Decision Fabric recommendations

**Development-only feature, not an autonomous decision authority.** October 24, 2026.

## The copy-first implementation

Bostan already includes a signed and company-scoped `decisions` table, agent
run provenance, signed option/effect specs, idempotent creates and board-only
decision outcomes. This wave **reuses that writer and its database**, rather
than creating another decision scheduler, board, agent or approval store.

New authenticated agent-run endpoint:

`POST /api/companies/:companyId/bostan-decision-recommendations`

The request includes an explanation, two to six typed alternatives,
recommended alternative ID, unique evidence-issue UUIDs, finite nonnegative
estimated/ceiling USD amounts, a confidence score and an idempotency key.
The input is strict and bounded, including prevention of duplicated evidence
and alternatives, invalid recommended IDs, NaN/Infinity, negative costs and
model-authored `effects` fields.

The service verifies **all** claimed evidence issues belong to the addressed
company AND are readable by the agent's actual authorized run actor. Unknown,
foreign or unauthorized references are rejected without persisting a decision.
It DOES NOT claim to verify factual relevance or truthfulness of an evidence
issue merely by validating its identifier and access policy.

For declared confidence < 0.75 or estimated USD cost > declared USD ceiling,
Bostan *abstains* and offers the human only `request_evidence` / `defer`.
Otherwise it persists the bounded typed alternatives. All alternatives have
`effects: []`: no model-generated command, issue mutation, money transfer,
connector call or task completion is authorized by this feature.

The generated recommendation is stored using the imported signed
`decisionService.create` with `ruleKey=bostan.decision_recommendation.v1`,
synthetic provenance and metadata declaring `calibrated:false`, explicit
abstention reasons, unverified evidence relevance, and `permitsEffects:false`.
A human may decide via the existing board interface and signed decision
path. Idempotent repeats reuse the exact existing decision record.

## Validation on Mac

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-evidence-recommendations.test.ts --maxWorkers=1`

**6/6 PASS, zero skips/failures**, including 4 real PostgreSQL tests:
- Idempotent signed decision storage, real human choice, and **zero** recorded
  side-effect executions.
- Low self-reported confidence causes abstention.
- Declared estimated cost above declared ceiling causes abstention.
- Attempt to reference another tenant's private issue is rejected and leaves
  **no** decision row.
- Two schema tests refuse duplicate/unknown option IDs, unknown fields,
  model-supplied effects, duplicate evidence and invalid/negative numeric input.

## Explicitly not yet qualified

- Confidence **is self-reported, not calibrated** against held-out outcomes.
  The 0.75 threshold is an initial policy, not an accuracy claim.
- The submitted budget ceiling is a request field, **not yet a board-set
  company budget**. This module never spends or executes; the existing
  authorization/budget gateway remains authoritative for real actions.
- Evidence UUID existence/read access does not verify whether the cited
  issue actually supports the recommendation. Grounding readback, retrieval
  provenance and independent evaluation remain B2/B4 work.
- Full server typecheck, browser UI for this new workflow, load/performance,
  real model integrations, Windows native E2E, and B2-B6 as a whole remain
  open until independently tested and qualified.
- Repo and actions remain private/disabled; development Draft only. No
  public deployment, paid services or branch merge. **RELEASE NO-GO.**

## Final local runtime and compiler result

- Actual Bostan source-runtime on Mac after the B2 route was added:
  `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
  **PASS, exit 0**. Private local health, real PostgreSQL company insert,
  graceful stop, restart and exact persisted company readback, second clean
  stop. This is a live app smoke, **not** a browser UI test for the new form.
- Full server TypeScript (incremental, with a private temporary build-info
  path) did **not** finish under its 175-second limit. It was terminated
  after timeout with exit 124 and no diagnostics. **TYPECHECK NOT QUALIFIED**;
  the passing B2 DB tests and real runtime smoke are not equivalent to a
  successful whole-project typecheck. Earlier B1-05 typecheck does not
  cover this branch. No lingering compiler process.
- `git diff --check`: PASS. No external model or paid service.
