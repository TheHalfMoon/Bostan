# B6-13 — Bostan identity in customer-facing UI and company import guidance

Private source development. No main merge, release, deployment, enabled GitHub Actions, external-model inference or paid tools.

## Changes

A focused UI audit found some functional Bostan screens still described the original source project as the active product.

- Grok Bot pairing, routine sessions, stop and recovery descriptions now correctly identify Bostan authority. The connected bot protocol and secrets are unchanged.
- Exported company README previously told recipients to use a donor-named npm executable. Guidance now uses the actual registered Bostan CLI command: bostan company import this-github-url-or-folder --dry-run . The --dry-run ensures an import preview before modification. Bostan CLI is not claimed to be published to npm.
- The agent audit permission-denied view now says administrator permission is needed rather than naming the donor's enterprise service. Immutable audit events are labeled recorded by Bostan, with the actual audit store and permissions unchanged.
- OAuth handoff, managed-cloud-service error copy, connection preview, Hermes setup and skill validation/workspace copy use Bostan or accurate neutral wording.
- Both default and production audit/skill implementations have matching changes.

## Preserved compatibility and lineage

Internal npm namespaces, API/protocol values, database keys, migrations, source/license requirements, and authentic third-party skill provenance are unchanged. Remaining donor references in other modules were not systematically removed. This PR does not claim full rebranding, and required donor attribution must remain intact.

## Verification on Mac, 2026-10-25

- UI TypeScript typecheck: PASS.
- Three company-export, company-skills and audit UI Vitest suites: 66 PASS, zero failures. Existing React act warnings did not change assertions.
- UI production Vite build: PASS with an existing large-chunk advisory.
- New static regression tests: 3 PASS, checking visible copy, matching registered Bostan CLI import command and safe preview, and preservation of protocol/source identifiers.
- Broad Bostan Node source: 135 PASS, 0 FAIL, 9 Windows-only SKIP.
- Alibaba local delegate preview is static file eligibility, not independent AI security review.
- No real external Grok/cloud session or installed Bostan CLI import was invoked; product E2E for those integrations remains unqualified.

## Remaining gates

Actual free-model first agent, exact run-owned source comment and independent reviewer/Case remain OPEN. Full server TypeScript on 8 GiB Mac was SIGKILL due resource pressure; installed Windows app and packaging, wider UI branding audit, security and release gates remain open.

Repository Private, Actions disabled, stacked unmerged Draft PR. Release NO-GO.
