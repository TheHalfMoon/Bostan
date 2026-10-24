# B2-03 — Bind non-effectful recommendations to exact cited evidence versions

**Private development; advisory recommendations only.** October 24, 2026.

## Remaining evidence gap after B2-01/B2-02

B2-01 verified that cited issue IDs belong to the same company and may be
read by the authenticated agent. But a recommendation's idempotency key could
still return an old signed decision after a cited issue was edited, because
prior advice only contained the referenced UUIDs. That is a provenance and
freshness gap, even for decisions which deliberately authorize no effects.

## Implementation

- Extend the existing company-filtered evidence issue fetch with immutable
  identity plus `status`, `projectId`, `updatedAt`, title and description.
  The existing actor-specific `issue:read` authorization still runs before
  any recommendation can be created. No other company's issues are selected.
- Build a canonical snapshot of **all** cited issues sorted by UUID. Include
  exact source fields and version timestamps. Create a domain-separated
  **HMAC-SHA256** using Bostan's existing private decision-signing key.
  This is an opaque content/version binding, not a copy of user documents.
- Persist only the HMAC, evidence count and `evidenceRelevanceVerified:false`
  alongside the pre-existing decision data; do not include private issue
  descriptions or their contents in the signed board summary or API metadata.
- Include the opaque HMAC in the signed decision body. A changed evidence
  version therefore makes the existing decision-service idempotency check
  reject the same key (409) rather than return an obsolete recommendation.
  A new proposal must be submitted with a new unique key and fresh snapshot.
- Reuse the **same** imported decision writer and board outcome flow. Every
  alternative still has `effects:[]`; nothing auto-executes or spends money.
- The HMAC is private-keyed, not a dictionary-attackable plain SHA of small
  or guessable content and not a permission to retrieve the source.

## What this does NOT mean

- An opaque HMAC demonstrates the *versioned contents used at proposal
  creation*, not independent factual support for a model's claim. Relevance
  verification and trustworthy full-text retrieval remain a B2/B4 priority.
- Freshness can change between recommendation creation and a later human
  decision. A proper live pre-decision revalidation flow is still required
  before recommendations can be considered externally verified.
- Browser UI, whole-server typecheck, real model routing, calibrated
  confidence, independent action verifier and all remaining B2–B6 gates are
  not complete. Release remains **NO-GO**.

## Verification

Real isolated synthetic PostgreSQL regression in
`server/src/__tests__/bostan-evidence-recommendations.test.ts` exercises:
company isolation; content change under the same UUID; exact stale-key
conflict; new-key regeneration of a different opaque evidence HMAC;
non-disclosure of the changed private description; and zero effects.

Executed test count and source smoke are recorded below after validation.

## Final verification — private Mac

- **14/14 PASS**, 0 failures/skips; 12 real isolated PostgreSQL integration
  tests and 2 source schema tests on the latest B2-03 branch.
- New B2-03 regression proves content-only evidence edits alter the opaque
  HMAC, old idempotency keys are rejected, new proposals carry a fresh
  fingerprint, private description text is not copied into the visible
  metadata and no executable effects are generated.
- Latest real local source app smoke:
  `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
  **PASS (exit 0)**. Actual PostgreSQL startup, private health, synthetic
  company persistence through restart, two graceful stops, TEMP cleanup.
- `git diff --check`: PASS. Full server typecheck is NOT QUALIFIED on this
  source head; prior time-bounded whole-project TypeScript runs exceeded their
  limit. Vitest transformation and a running source app do not replace a full
  typecheck. No paid inference, live external connector or publishing.
