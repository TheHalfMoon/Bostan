# B2-02 — Honor existing board-set budget policies in recommendations

**Private development; advice only, no model or provider dispatch.** October 24, 2026.

## Gap closed

B2-01 compared agent-submitted `estimatedCostUsd` only with the same agent's
submitted `costCeilingUsd`. This is useful for request validation, but does
not reflect a **human-configured** company budget. An agent could set an
arbitrarily high declared ceiling and present itself as within budget.

B2-02 reuses the original, authoritative `budget_policies`, `cost_events`,
`budget_reservations` and `budget-exposure` read logic. It does not invent a
new budgeting table, spend ledger, reconciler, or finance authority.

## Runtime policy

- Verify a company-scoped agent run and its original task; derive the project
  scope from the **actual origin task in PostgreSQL**, never a project name
  submitted by the model.
- Read **only** applicable company, agent, and origin-project policies matching
  the current company and `billed_cents`, `active`, `hardStopEnabled`, and
  amount greater than zero. Apply every applicable policy, not just the
  largest ceiling. Existing project-specific and lifetime/window rules come
  from the source schema.
- Use `computeObservedSpends`, the same established accounting projection as
  provider admission, to examine ledger usage, unfinished/live amounts,
  reservations/holds, unpriced records, and unresolved terminal runs.
- Convert the model's estimated USD cost with the shared exact-money helpers;
  compare expected exposure against each relevant policy amount. If projected
  costs exceed any limit, or recorded accounting is unsafe under that policy,
  **abstain** with `board_budget_capacity_exceeded` or
  `board_budget_accounting_unknown`. The agent's declared ceiling can *only*
  make abstention stricter; it cannot raise board policy limits.
- Continue to allow historical B2-01 recommendation behavior where no active
  applicable board hard-stop policy is configured. This is backward-compatible
  **advice only**, NOT spend admission or a company budget guarantee; the
  separately owned budget authority still gates real paid work.
- Every resulting option has **zero effects**, including when the board
  is below budget: a favorable advice result is not a reservation, grant,
  expense authorization, tool invocation or task completion.

## Privacy and idempotency

A regular authorized agent is not automatically entitled to read a board's
internal account balances. Although the guard queries exact board policy
amounts and accounting receipts internally, it **does not expose** them or
policy IDs to the agent via persisted `decision.metadata` or the human review
body. Instead, it records only applicable-policy count, safe abstention
reasons, and a sorted, keyed HMAC-SHA-256 fingerprint using the existing private decision
signing secret of the policy/exposure snapshot.
The fingerprint is included in the signed decision body so a policy or balance
change cannot silently reuse an idempotent recommendation containing an
outdated budget check. A changed snapshot with a reused idempotency key is
handled by the existing `decisionService` conflict contract; a new proposal
requires a new idempotency key.

Unlike a plain unkeyed hash of low-entropy financial amounts, the keyed
HMAC prevents straightforward offline guessing by an agent that can see its
own decision metadata but cannot read the signing secret.

This fingerprint is not a cryptographic permission to spend. Actual policy
admission happens anew during any future execution.

## Verification

Run real synthetic PostgreSQL 17 tests with the test-only source harness:

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-evidence-recommendations.test.ts --maxWorkers=1`

Test cases cover scoped company/agent/project caps, a restrictive policy
winning over a permissive one, actual previously-accounted ledger expense,
foreign-company budget isolation, valid under-budget advice without effects,
unknown evidence isolation, reported confidence abstention, schema safety and
signed idempotent human decisions. Final counts are appended after execution.

## Explicit limits

- Budget snapshot checks are read-only and **not transactional reservations**.
  The subsequent provider spend path must re-enforce current budgets.
- The estimated cost comes from an agent and may be false; independent
  quotation or model-metering is not yet qualified.
- No applicable budget policy does not mean zero cost or budget authorization.
- Confidence is self-reported and uncalibrated; evidence issue existence/read
  privilege does not prove support for the model's claim.
- Full server typecheck, live new-route HTTP E2E, agent/browser UI, stress
  testing, provider pricing and complete B2-B6 remain open qualification.
- Repo private, GitHub Actions disabled, PR stacked Draft, main not merged,
  no public release/deployment, real model call or paid provider. **NO-GO.**

## Final executed evidence on macOS

- Latest final B2-02 + keyed private budget fingerprint:
  **13/13 tests PASS**, with **11 real PostgreSQL integration cases** and
  two strict-input schema cases, no failures and no skips.
- Added explicit idempotency regression: after a board policy is lowered,
  the same request key can no longer return the formerly favorable signed
  recommendation. It receives a conflict; a new key yields an abstaining
  recommendation with a different private HMAC fingerprint.
- Ledger regression uses an actual synthetic `cost_events` row and verifies
  that previously settled cost reduces remaining capacity. Project guard
  is scoped to the authenticated run's original issue project, not arbitrary
  references supplied by the agent.
- Mac source local application smoke on this B2-02 head:
  `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
  **PASS, exit 0**. Private HTTP health, real PostgreSQL, synthetic company
  create, clean stop, restart and exact company persistence, second clean
  stop. No orphan temporary profile or paid inference.
- `git diff --check`: PASS. Full server TypeScript remains NOT QUALIFIED
  after repeated time-limited whole-project checks on prior B2/B1 heads;
  no claim of a clean latest-head full typecheck is made here.
