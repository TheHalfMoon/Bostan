# B3-01 — Action Fabric starts with honest side-effect evidence status

**Private source-development only, October 24, 2026. Not an effect verifier.**

## Copy-first design

Bostan already inherited company-scoped, durable `tool_invocations`,
`tool_action_requests` and `tool_call_events` with provider request IDs,
result summaries, result hashes, risk classification and terminal statuses.
This first Action Fabric wave reuses that trusted source of recorded tool
attempts, rather than duplicating an invocation/side-effect writer.

Add a narrowly scoped, board-only, read-only endpoint:

`GET /api/tool-gateway/bostan-action-evidence/:invocationId?companyId=<uuid>`

It shares the existing board gate and **`tools:view_audit`** permission and
filters the record by both exact company UUID and invocation UUID. An agent
cannot probe these private audit states; a user from another company cannot
read the record. No tool arguments, credentials, raw output or result hash
bytes appear in the returned JSON. The presence of a redacted result digest
is represented only as a boolean.

The conservative classifier reports:

- A successful high-risk/write/destructive tool invocation has
  `assessment: readback_required`. This only means the tool reported success;
  an independent provider-state readback is still required to verify effect.
- A successful read/low-risk invocation has
  `assessment: reported_result_unverified`, not an independently verified
  state of the external world.
- Timed-out invocations or failed/cancelled operations with possible side
  effects receive `assessment: external_outcome_unknown` and explicitly
  require human reconciliation *before any retry*.
- Pending/approved/executing requests remain `in_progress`; denied or
  rate-limited requests are distinct from a claimed successful operation.
- **`independentEffectVerified: false` and `autoRetrySafe: false` for every
  record**, regardless of upstream result. This wave neither retries work
  nor fabricates an independent verification receipt.

The server returns a stable action-state assessment, recommended next
operator action and safe metadata only. Existing tool execution, company
approval, signed argument replay, budget accounting, retry and receipt
contracts are untouched. No new schema or external provider calls.

## Real test evidence

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-action-evidence-status.test.ts --maxWorkers=1`

**5/5 PASS**, including 2 isolated PostgreSQL/real Tool Gateway HTTP route
integration scenarios and 3 pure classification tests: write success does
not imply a verified effect; read-only success remains unverified;
timeout/failed/destructive cancellation is not assumed safe to retry;
denied/pending statuses remain distinct; private redacted audit information
is available to an authorized local board; other tenants and agents are
denied, and malformed UUIDs rejected. The source records were synthetic and
created in an ephemeral PostgreSQL test database.

## What remains for an actual Action Fabric

- **Independent post-action readback** from a provider or local file system
  using a separate authorized verifier has NOT been implemented.
- Unknown-outcome reconciliation must prevent duplicate destructive writes
  and require evidence/approval; this service only classifies cases.
- Action receipts still need cryptographic evidence linking intent, approved
  arguments, observed state and an independent verifier with revocation
  fences. End-to-end computer/browser agent QA and B3–B6 are open.
- Latest backend whole-project TypeScript remains unqualified after prior
  bounded compiler timeouts. These passing targeted tests do not supersede
  that gate.
- No paid service, user customer records, remote provider invocation,
  deployment, merge or release. Repo private; Actions disabled; main intact.
  **Release NO-GO.**

## Final source-runtime receipt

The latest B3-01 branch also passed
`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
(exit 0): real private local source Bostan/PostgreSQL health, synthetic company
creation, graceful stop, restart/exact saved company verification and second
clean stop. Temporary Mac test profile removed. `git diff --check` PASS.
