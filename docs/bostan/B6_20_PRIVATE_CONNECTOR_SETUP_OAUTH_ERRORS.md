# B6-20 — Do not reveal OAuth and cloud-connector upstream errors

Private Bostan source work. No main merge, release, deployment, inherited Actions, paid provider or real third-party connection changes.

## Security issue

The Bostan provider connection-setup UI still echoed raw error.message strings from:
- the initial OAuth handoff preparation;
- start-OAuth mutation failures (both general and automatic OAuth);
- managed Cloud connector enrollment failure;
- a rejected enrollment authorization target.

Upstream/provider errors may include OAuth authorization code, state, signed URLs, or secrets. This remained after B6-14 had protected the separate dedicated handoff landing page and Grok panel.

## Scoped fix

- Add pure safeBostanConnectionOAuthStartError and safeBostanConnectorEnrollmentError functions to the existing Bostan connection error helper.
- Unknown OAuth errors show only a constant Bostan retry message. The trusted machine-readable API detail code invalid_grant can select the specific, fixed, actionable expired-authorization message. Raw provider exception messages never reach OAuth status.
- Cloud connector enrollment and invalid target now show a fixed safe message instead of raw provider/transport errors.
- Correct adjacent user-facing product name on the popup failure and enrollment-link failure copy to Bostan/neutral wording.
- Do not alter authorization URLs, token storage, account registration, OAuth origin validation, redirect behavior, API fields or actual connector policy.
- Preserve internal protocol IDs and required legal provenance. This is not a blanket replacement of donor strings.

## Mac regression — 2026-10-26

- Existing connection OAuth tests plus expanded connection error privacy tests: 34 PASS, 0 FAIL (18 + 16).
- Static source wiring guard asserting both raw error surfaces route through safe helpers: 1 PASS.
- UI full TypeScript typecheck: PASS.
- Actual Vite production UI build: PASS (existing >500 KiB chunk advisory persists).
- Broad Bostan Node source tests: 149 PASS, 0 FAIL, 9 Windows-specific SKIP (158 total).
- No real external OAuth/Cloud provider account operation, no user secrets inspected or transmitted. Pure tests use synthetic code/state and credential-like strings.

## Remaining release gates

This protects four high-impact connection error entrypoints; it does not qualify all connector provider permutations, end-to-end OAuth tokens or full independent security signoff. Actual free-model first/second agent Case acceptance, formal full server compiler/build, installed Windows distribution and full private package import remain OPEN.

Private repo, Actions disabled, Draft stacked PR, no public release or main merge. Release NO-GO.
