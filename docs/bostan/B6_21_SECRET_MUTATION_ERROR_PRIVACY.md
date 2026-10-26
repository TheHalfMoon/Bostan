# B6-21 — Secret operation error privacy (private Draft)

This Bostan change is stacked on B6-20 / PR #140. It is not a release, main merge, deployment or authorization to use paid models or real external credentials. Required upstream license and provenance remain unchanged.

## Risk

The secret-management screen directly rendered error messages for rotation, secret and user-secret status/delete actions, vault save/disable/remove/default/health failure toasts, clipboard failures, secret-list loading and provider-vault loading. Upstream error text can include a provider request URL, authorization state, a credential fragment or secret-related metadata. No provider error must become a user-facing toast or query-error banner.

## Fix and scope

- Replace direct raw exception messages in **14 source display sites** with stable Bostan failure copy.
- Keep retry controls, mutation semantics and API contracts unchanged.
- Do not execute provider access, use real user secrets, alter storage or change OAuth behavior.
- Test mocked secret-list/vault-list errors carrying synthetic credential-like text and vault-save errors carrying a synthetic OAuth authorization URL; assert failure guidance is shown but secret markers are absent.
- Update a pre-existing test's outdated donor-brand assertion to match the already-shipped Bostan removal dialog; preserve mandatory upstream attribution in packages and licenses.

**Remaining**: other secret creation/AWS structured-error diagnostic fields, provider discovery, agent-access errors, and other app screens need an independent privacy audit. This PR deliberately does not claim a complete security sign-off. Normal server compiler, real two-model reviewer/Case acceptance, installed Windows distribution and release remain open.

## Verification

- Focused Secrets React UI suite: 32/32 PASS (includes 2 new synthetic-leak tests).
- Full UI TypeScript (tsc -b): PASS.
- Real production UI Vite build: PASS; pre-existing >500-KiB chunk advisory persists.
- Broad Bostan Node source tests: 149 PASS, 0 FAIL, 9 Windows-only SKIP (158 total).
- No real provider network calls, credentials, or user data used.
