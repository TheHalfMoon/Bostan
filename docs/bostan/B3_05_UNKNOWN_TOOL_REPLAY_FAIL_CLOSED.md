# B3-05 — Do not report unresolved side-effectful idempotent replays as successful

**Private development, 2026-10-24; no deployment, paid models, release or actions.**

## Problem in the imported Tool Gateway

For a normal, idempotency-key-bound invocation, the imported tool gateway
reuses the original persisted invocation row. A retry of a successful
operation returned a non-executing `status: replayed` and redacted prior
result, as expected. However the same response path could also return the
generic `replayed` status when a potentially side-effectful operation had
`status: timed_out`, `failed` or `cancelled`, although the effect might have
reached an external provider before its response was lost. Such a response
could be mistaken by a consuming agent for a successfully verified outcome.

## B3-05 fail-closed replay response

At the existing authoritative branch that handles a replay of an approved,
ordinary tool invocation, classify the **original durable** invocation's
risk level and terminal status. If risk level is write/approval/high or
unknown, and the prior status is `timed_out`, `failed` or `cancelled`:

- Return HTTP **409** with stable reason code
  `tool_effect_outcome_unresolved`, not `status: replayed`.
- Log the original invocation and reason in the existing tool audit; do not
  insert or dispatch another invocation and do not provide a fabricated
  successful effect receipt. Human/provider reconciliation is required
  before taking further action.
- Preserve the imported ordinary idempotent replay behavior for a previously
  successful invocation and existing specialized Slack rate-limit recovery
  and GitHub publication receipt-readback flows, which have their own source
  authority and qualifications.
- This is a precise correction to **same-key replay presentation**. A new
  idempotency key might still create a different invocation; B3 still needs
  authority-bound cross-key unknown-outcome reconciliation and replay fences.

The imported permissions, provider dispatch, board approval, ledger,
company ownership and action authorities are unchanged. No new tables,
credentials, provider requests or cloud operations.

## Actual Mac SQL & Gateway integration

The previous imported test fixture's embedded PostgreSQL image does not start
reliably on this Mac. The test suite now reuses the existing Bostan opt-in
**isolated system PostgreSQL test backend** when explicitly requested by
`BOSTAN_TEST_POSTGRES_BACKEND=system`. Default behavior still routes to the
original embedded backend. No existing user database is accessed or dropped.

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/tool-access-policy-service.test.ts --maxWorkers=1`

**50/50 PASS, zero failures/skips** on real temporary PostgreSQL. This
includes the new B3-05 regression: a synthetic `mcp-remote-fixture:update_note`
side-effectful call first executes successfully; with the original invocation
then deliberately marked `timed_out`, `failed`, and `cancelled` in turn,
repeating the exact same idempotency key gets HTTP 409 and preserves the
same one invocation. The existing successful idempotent replay scenario
remains PASS, along with all 48 other tool policy and gateway tests.

## Qualification gates

- This does NOT prove or independently inspect the external effect, nor does
  it authorize an automatic retry with a different key.
- Separate authorized provider-state readback, ambiguous outcome
  reconciliation and cross-key duplicate prevention remain open B3 work.
- Latest whole-server TypeScript on this 8GB Mac remains unqualified due to
  120-second memory/disk pressure timeout on the previous B3 head.
- Windows native local first-agent acceptance, browser-connector effects,
  B4/B5/B6 and release remain open. Private repo, Actions disabled,
  main unchanged. **NO-GO.**

## Latest-head real private source runtime

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
**PASS, exit 0** on Mac after B3-05. A fresh private PostgreSQL cluster,
loopback-only Bostan HTTP health, synthetic company INSERT, graceful stop,
restart with exact company readback and a second clean stop were verified.
The temporary successful test HOME was cleaned. This confirms application
startup/persistence but not external connector execution or a Windows
installed-product journey. `git diff --check` PASS.
