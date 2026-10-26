# B6-30 — GitHub App recovery: never echo provider key material

Private Bostan development, 26 October 2026; Draft stacked on PR #156 B6-29. Do not merge to main, publish, deploy, enable GitHub Actions, incur paid model costs, access real customer credentials or remove required donor/license attributions.

## Real exposed frontend paths

The GitHub App endpoint recovery surface displayed raw endpoint.lastError or endpoint.healthMessage in a collapsible operator "Connection details" panel. It also showed the original thrown Error.message from rejected onConnect() calls in a visible reconnect error panel. Both values may be influenced by an upstream provider response and could reflect webhook signing secrets, personal access tokens, OAuth state or PEM key bytes.

The same recovery UI also had two leftover user-facing donor-brand references ("App already saved in Paperclip" and "Paperclip will check the App"), despite Bostan identity elsewhere. Internal protocol keys and legal provenance were not changed.

## Scoped fix

Add two actions, githubHealth and githubCredential, to the existing centralized safeCredentialUiError helper. Connection details and rejected reconnect attempts now show short fixed Bostan-branded copy, never the untrusted raw value or a regex-partial mask. Keep genuine status/revocation flags, reconnect URLs, previously saved App identity, credential replacement field semantics, onConnect callback and GitHub key validation behavior unchanged. Change only the two user-visible product labels to Bostan, not upstream required legal notices.

## Grounded tests

- Real React DOM/SSR component tests render GitHubConnectionRecoveryNotice with synthetic bearer tokens and signed URLs for BOTH attention/revoked statuses, and mount the real GitHubAppRecovery interactive reconnect action whose Promise rejects with synthetic PEM key content. Assert none of these markers appear in the resulting rendered DOM/error panel.
- Shared safe credential copy helper has injection assertions for the two added variants.
- Focused two-file Vitest suite: **23 PASS, 0 FAIL**.
- Official UI TypeScript tsc -b and Vite UI production build: PASS (pre-existing chunk size advisory).
- Native Mac Bostan Node source: 165 PASS, 0 FAIL, 9 platform-specific SKIP (174 total).
- Five canonical signed independent Case/JWT/HTTP/real PostgreSQL/native bridge suites: 22 PASS, 0 FAIL.
- Private Chromium persistence and native Windows source tests are recorded separately after exact-head qualification.

This is targeted protection of one credential-bearing recovery interface, not an independent security review, not installed Windows qualification, and not evidence of an actual model-authored signed Case. Official entire-server build/typecheck, resource-gated real free native Case with an independently authored JSON report, Windows installed app E2E and comprehensive security audit remain NO-GO.
