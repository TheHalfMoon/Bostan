# B5-34 — Independent Case reviewer cannot author their own cited source

Private Bostan development, 26 October 2026. No public release, deployment, main merge, paid inference, inherited GitHub Actions or real customer activity.

## Source security gap

The previously qualified governed Case gate checked the original delivered cross-agent handoff, successful reviewer run, run-authored bounded JSON report and current source HMAC. This established true identity and document freshness, but not independent **source authorship**. An active reviewer could create a different normal task document in the source app, obtain the perfectly valid digest for its own document, cite it in the otherwise legitimate review report and request Case Done. The source snapshot HMAC binds document content and revision, but does not incorporate who authored it.

## Fix

The original assertBostanCurrentVerificationEvidence transaction now also checks the CURRENT revision's authenticated author for every cited source, through the existing company- and issue-scoped issue-document linkage and document latest-revision join, taking share locks alongside existing HMAC checks. It rejects any current source revision authored by the same agent who is assigned to review the case. It rejects missing revision provenance. It preserves the current source HMAC freshness checks and allows non-reviewer authors, including existing board-origin data with no recorded agent author. A missing agent author is NOT proof of human review, factual correctness or authorization.

This guard runs both at terminal intent acceptance and again at final original Issue Done; the founder's existing read-only current-review route shares the same core validation. No new database tables, bypass paths, second source ledger, provider calls, mutable policy, or change to legacy ungoverned Cases.

The bounded regression deliberately changes ONLY the actual latest source revision's agent author to the verifier in isolated PostgreSQL, retaining the exact already-approved current HMAC. It then asserts 409 bostan_verifier_source_not_independent, no Case Done, and successful original terminal handoff after restoring the independent specialist author. This targets the authorship bypass rather than the separately existing stale-HMAC guard.

## Evidence

- Real PostgreSQL native bridge + verifier + source HMAC focused suites: 16 PASS, 0 FAIL (3 files).
- All five original Case/Native JWT/source snapshot suites: 21 PASS, 0 FAIL, 0 SKIP. The existing valid independent specialist-authored source still closes the actual Case/Issue transaction.
- Focused founder-summary regression: 4 PASS, 0 FAIL. The read-only board summary becomes current=false with a null bounded report when the latest cited source author is changed to the reviewer without changing its HMAC; restoring the distinct specialist immediately restores current=true.
- No live AI model was used for the negative test; verifying auth/provenance transaction semantics does not qualify AI factual reasoning.

## Remaining gates

The model-driven full founder/CEO/specialist/independent reviewer story, external effect readback, consent and $0 budget enforcement, official entire-server TypeScript/build on adequate resources, installed Windows distribution and comprehensive independent security review are not yet qualified. Release NO-GO.
