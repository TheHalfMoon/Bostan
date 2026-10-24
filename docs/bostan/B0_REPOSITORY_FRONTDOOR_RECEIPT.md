# B0-24 — Bostan repository security and contribution front door

**Status: private development identity repair. Not product release qualification.**

## Problem

The initial source import retained inherited public entry points that could
send a Bostan vulnerability report to a different project's advisory inbox,
route feature discussion to an unrelated Discord, misidentify the project
in private issue templates, or impose upstream-specific release, review and
contribution rules. These are repository-level trust and identity defects.

## Change

- Replace the security disclosure address with the private Bostan advisory
  route and, when unavailable, an existing private owner contact. Avoid
  public exploit disclosures.
- Replace the inherited contribution process and PR template with private
  Bostan Draft PR, isolated test, no-deploy and evidence requirements.
- Replace inherited upstream roadmap availability claims with actual Bostan
  qualification status and explicit B0–B6 incomplete gates.
- Correct feature, adapter, bug, enhancement and issue-chooser references.
- Add source-only Node tests that refuse old-brand routes, channels and
  inherited review requirements in the chosen repository front-door files.
- Keep `LICENSE` intact; preserve necessary attribution and compatibility
  records in legal/source documentation rather than pretending the source
  was originally written for Bostan.

## Evidence and limitations

Run `node --test scripts/bostan-repository-frontdoor.test.mjs` and the
existing focused local source/agent tests. Confirm `git diff --check`.
These tests assert text-level route/identity integrity; they do not prove
GitHub security-advisory permissions, full UI identity migration, an
independent security assessment, source packaging, model stability, or
consumer installer qualification.

The Windows full first-agent CLI harness remains an open regression gate;
the prior direct Windows synthetic agent task completion stands, but is not
substituted for an end-to-end CLI rerun. No paid model, real account, shared
HOME, external deployment or publication is used. Private stacked Draft PR;
`main` remains unchanged, Actions stay disabled and release is **NO-GO**.

## Local verification — macOS, October 24, 2026

`node --test scripts/bostan-*.test.mjs cli/src/__tests__/bostan-preview.test.mjs`
completed with **76 passed, 0 failed and 9 Windows-only skips**. The
repository front-door test file contributed **2/2 passes**. `git diff
--check` passed. An exploratory wider clean-checkout invocation including
`cli/src/__tests__/bostan-local-install.test.mjs` had **one failure** because
`cli/dist/bostan.js` was absent in this source-only checkout (not built).
The compiled distribution install test remains **NOT QUALIFIED in this run**;
there is no assertion that a source-only pass proves a packaged installer.
