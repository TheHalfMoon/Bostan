# B6-31 — Chat lifecycle and AgentMail inbox credential-error privacy

Private Bostan development on 26 October 2026. Stacked Draft from B6-30 / PR #157. No merges into main, deployment, publication, inherited GitHub Actions, paid model calls or removal of donor licenses/notices.

## Source issues and consequences

The B6-27 through B6-30 credential privacy patches protected tools, connections and GitHub App recovery, but general chat endpoint health and email inbox screens still displayed untrusted error content to operators:
- The ChatEndpointDetail health panel derived message, previousHealth and error directly from provider-controlled endpoint.healthMessage / endpoint.lastError even if lifecycle status was safe. A failed webhook or OAuth provider may put a credential or signed URL in those strings.
- AgentMail connection overview rendered each inbox.lastError and inbox-list rejected error.message raw.
- AgentMail inbox settings rendered lastError, failed control and reconnect error.message raw, which may include an API key. The setup-progress load failure also appended the original rejected exception text.
- Two remaining user-visible chat/email texts used the donor's former brand instead of Bostan.

## Scope of patch

Extend B6-27's existing fixed safeCredentialUiError helper with chatHealth, chatError, emailHealth, emailAction and emailLoad. These functions never read/copy provider strings, render URLs, or depend on regex redaction. Route the credential-bearing health, historical health, and error messages into static Bostan feedback while retaining the original lifecycle status, current vs historical labels, attention badge, inbox address, pause/resume/removal, reconnect operation and provider API behavior. Replace the two remaining user-facing donor-brand labels in affected screens, preserving internal protocol IDs and required attribution.

## Tests

- React and presentation unit tests inject fake Bearer tokens, provider-signed URLs, and token-bearing rejected inbox operations; the visible content and summarized health must contain only Bostan-safe copy.
- Tests retain exact lifecycle states and separate current-vs-historical error labels, and still allow reconnection and inbox-control calls.
- Three focused test files on Mac: 97 PASS, 0 FAIL; warning about existing React act environment in email test.
- UI official TypeScript project build and Vite production build: PASS (existing >500 kB chunk advisory).
- Mac source Node tests: 165 PASS, 0 FAIL, 9 platform SKIP, 174 total.
- Original five canonical independent Case/JWT/native runner/real PostgreSQL suites: 22 PASS, 0 FAIL.
- Real Mac isolated source Bostan HTTP/PostgreSQL company creation, clean stop/restart, persisted data and headless Chromium UI: PASS, 0 browser page errors, 0 blocked external requests, clean stop.
- Native Windows Abdulaziz Bostan Node source on B6-31 code head: 167 PASS, 0 FAIL, 7 platform SKIP (174 total), without Windows installer, user-process cleanup or customer file access.

## Release boundaries

No claim that all chat/email provider result fields are audited. This does not qualify a real model-led signed independent Case, full official server compilation, installed Windows application/installer, actual provider billing receipts, or comprehensive independent security review. Release remains NO-GO. No real customer API key is used in tests.
