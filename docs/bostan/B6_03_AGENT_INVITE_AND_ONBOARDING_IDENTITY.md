# B6-03 — Bostan external agent onboarding and guidance identity

**Private source-only draft. No merge, public release, deployment, paid provider calls, or GitHub Actions.**

## Scope

After B6-01 and B6-02, external agent invitations, onboarding.txt and llms guidance, Dot and Grok connection prompts, the native CEO/default agent setup instructions, and the shared external-agent tool guidance still told new agents that they were joining a different product. That was an active functional identity mismatch, not just a website branding issue.

## Changes

- Adopt Bostan product language in generated invite registration and claim instructions, Hermes Gateway technical guidance, agent and CEO first-run AGENTS.md templates, UI-generated external agent welcome prompt, Dot pairing and Grok Bot setup/routine messages, and the shared first-party external-agent tool guidance.
- Retain actual internal keys, schemas and tool names without silent migrations: PAPERCLIP_API_KEY, PAPERCLIP_API_URL, agentDefaultsPayload.paperclipApiUrl, paperclip_dot_*, paperclip_grok_*, the existing native runner ID and the currently implemented paperclipai CLI compatibility command remain functional. Keep original software attribution/license records.
- Replace only inert synthetic donor-branded example hostnames in the generated technical guidance. Do not invent a Bostan CLI release.
- Regression tests verify human-facing Bostan identity and preserved protocol IDs in generated UI and HTTP-facing onboarding text.

## Qualification — Mac, October 25, 2026

- UI invite/Dot/Grok regressions: **11/11 PASS**, four Vitest files.
- Server invite onboarding.txt and llms generated document tests: **6/6 PASS**, two Vitest files.
- Server default-agent materialization regression: **1/1 selected test PASS**. The other 117 tests in that broad file were intentionally excluded by exact test-name filtering (not a full-file PASS).
- Shared TypeScript typecheck: **PASS**.
- UI TypeScript typecheck and Storybook catalog: **PASS**.
- UI production bundle: **PASS** with inherited large-chunk warnings.
- Git whitespace verification: **PASS**.
- Tests used a private per-worktree module overlay so changes to the shared guidance came from this branch, without altering another Bostan checkout. It is a test setup detail, not a distributable npm artifact.

## Explicit boundaries

No real autonomous CEO/specialist/verifier inference or provider action effects have been qualified here. Not all legacy package namespaces, backend error messages, documentation, CLI, OAuth service paths or on-disk identities have been rebranded or migrated. Full server-wide TypeScript, installed Windows browser journeys, B4 knowledge/analytics, full B5 acceptance, B6 packaging, security signoff and release are still OPEN. No publication performed.

**Release: NO-GO.**
