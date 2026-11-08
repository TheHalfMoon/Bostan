# B0-26 — Fail-closed private feedback export and Bostan links

**Development only — not a release or an endorsement of external sharing.**

## Identified privacy issue

The imported feedback client used a hard-coded fallback to an upstream
telemetry endpoint. Even without a configured feedback backend, a vote
marked for sharing could attempt an upload of an AI-output trace containing
company/task material. No evidence has been collected that any actual Bostan
user data was sent, but that default is not acceptable for a private,
local-first Bostan product.

## Implemented protection

- Legacy telemetry URL/token environment variables no longer configure
  feedback export. `loadConfig` returns no export destination by default.
- Opt-in requires **all three** separately set, on the actual Bostan server:
  `BOSTAN_FEEDBACK_EXPORT_ENABLED=1`,
  `BOSTAN_FEEDBACK_EXPORT_BACKEND_URL=https://<operator-managed-host>`,
  `BOSTAN_FEEDBACK_EXPORT_BACKEND_TOKEN=<secret>`.
- Destination admission additionally requires HTTPS, a valid host,
  authentication token, and no user-info, query, fragment or non-default
  port. Hard-coded legacy upstream hostnames and localhost are refused.
- HTTP redirects are refused (`redirect: "error"`) so a configured
  destination cannot silently redirect an uploaded trace elsewhere.
- Newly created shareable exports have destination `bostan_feedback_v1`.
  The delivery work queue filters on that exact destination. **Imported
  upstream pending/failed records stay untouched** and are not silently
  replayed to a new private backend. Their presence is not treated as
  authorization to transfer.
- The **server-side issue-vote route**, not just the visible UI, forces
  `allowSharing=false` when the destination is not admitted. The vote is
  still saved locally; an unconfigured server cannot queue an outbound trace
  merely because a stale UI client or saved consent requested sharing.
- Removed inherited upstream Terms of Service fallbacks. A terms link can
  appear only after explicit Bostan-specific frontend configuration.
- User-facing consent copy says an operator must configure a backend. It
  no longer promises that an unverified “Bostan Labs” entity receives data.
- Default account-menu documentation and feedback destinations now point
  to the owner's **private Bostan GitHub repository**, not to the donor site.
  This can require authorized GitHub access, by design.

## Boundaries / future work

This does **not** independently audit all other egress paths (agent tools,
plugins, integrations, Sentry, update checks, AI providers). This wave gates
only the feedback trace transport and associated default UI controls.
Existing failed or pending trace records from an older developer copy are
not deleted, migrated, or exported here. **Before enabling an explicitly
configured backend in the future**, inventory and separately quarantine or
reconcile those records with informed operator consent; they must not be
bulk-sent based on a historical upstream consent. This gate is not proof
of production isolation, completed legal terms, or production telemetry
qualification. Never assume `PAPERCLIP_FEEDBACK_*` config is valid in Bostan.

## Acceptance receipts

Record exact Mac native focused server and UI test counts, typecheck and
any platform-specific skips. Keep GitHub Actions disabled, the repository
private, `main` unmodified, and the PR as an unmerged Draft. No paid model,
deployment, release, publishing, account connection, or data upload occurs
in this verification.

## Local verification receipt — Mac, October 24, 2026

- Focused server Vitest for Bostan config, upload transport, and **real
  Express issue-vote route with service mocks**: **21 passed, 0 failed**.
  Tests include allowSharing=true refusing remote sharing by default and
  allowing it only with an admitted backend option.
- Startup integration with mocked services and export-flush controller:
  **42 passed, 0 failed** after updating the test mock to preserve the
  real `configuredBostanFeedbackEndpoint` helper. Vitest emitted listener
  warnings but tests passed.
- Targeted UI Vitest for SidebarAccountMenu, InstanceGeneralSettings,
  IssueChatThread and IssueDetail: **301 passed, 0 failed**.
- UI TypeScript `tsc -b`: **PASS**. UI Vite production bundle: **PASS**,
  with inherited large-chunk warnings. `git diff --check`: **PASS**.
- Database-backed `feedback-service.test.ts`: **17 SKIPPED** because the
  embedded PostgreSQL cluster could not start on this Mac. This includes
  the new test that requires the durable queue to leave inherited upstream
  pending exports quarantined. **Do not claim PostgreSQL E2E PASS.**
- Whole-server `tsc --noEmit`: **NOT QUALIFIED**; failed with missing
  generated `@paperclipai/paperclip-runner` module declarations and related
  cascading errors in this fresh checkout. The full Runner vendor build was
  not attempted. No changed feedback file error was reported in the partial
  output, which is not a substitute for a clean typecheck.
- Actual remote destination, DNS, HTTP backend, Windows executable and
  consumer installer acceptance remain **NOT RUN**. No external upload was
  performed; upload behavior was tested with a mocked `fetch`.

Release remains **NO-GO**. GitHub remains private, Actions disabled,
`main` unchanged. Full B0 privacy and UI rebrand are not yet complete.
