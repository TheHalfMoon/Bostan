# B6-27 — Gateway/token and imported MCP/OAuth error privacy

Private Bostan development, 26 October 2026. Draft stacked on B6-26/PR #153. No merges into main, deploy, public release, inherited Actions or paid services. Retain all mandatory source licenses and notices.

## Concrete problem

Named MCP gateway creation, gateway bearer-token issuance/revocation, list-loading failure and clipboard failure previously reflected raw rejected `Error.message` or `String(error)` into customer-visible toasts / error panels. A failed upstream gateway operation can include bearer tokens, signed URLs, provider payloads or credentials in exception text. Pasted MCP imports accept credential replacement fields, and OAuth start/navigation can include authorization code or state; their rejected errors were also rendered from exception text. Such server/provider exception bodies are not UI-safe.

## Copy-first fix

Added one narrow constant-copy guard `safeCredentialUiError(error, action)`. It ignores the untrusted argument and emits fixed Bostan phrasing. Wired it into:
- Gateways list loading, create gateway, issue/revoke bearer token and copy failure feedback.
- Paste MCP JSON import preview error, credential-bearing app connection, activation, OAuth start and OAuth navigation rejection.

The normal success flow still renders the newly issued one-time token only in its intended protected success panel. The fix does not alter API calls, backend authorization, policy, persisted secrets, or provider integration. It does not log, redact by fragile regex, echo error input, or change official production runtime semantics. It intentionally sacrifices provider-specific raw diagnostics in these credential-heavy end-user surfaces; administrator/server logging policy is a separate issue.

## Actual tests and limits

- Focused three files: 25 PASS, 0 FAIL. All nine sensitive action variants reject synthetic injected OAuth code, state, signed URLs, bearer tokens and arbitrary exception objects. React component tests demonstrate a gateway create/list failure, imported MCP config failure, and OAuth start failure cannot put injected secret markers on screen or in toasts.
- UI official `tsc -b` and Vite UI build: PASS. Existing large bundle size advisory persists.
- Native Mac Bostan Node source: 165 PASS, 0 FAIL, 9 platform SKIP (174 total). Source-brand static check was updated to assert branded copy in the new centralized module instead of requiring its duplicate literal in the page.
- Real disposable macOS local Bostan HTTP/PostgreSQL stop/restart/persistence + headless Chromium smoke: PASS, browser errors 0, blocked external requests 0. This broad smoke validates app boot and persistence, **not a live malicious OAuth provider interaction**.
- Five-file canonical governed Case/JWT/HTTP/real PostgreSQL/native bridge suite on the amended head: 22 PASS, 0 FAIL.
- Native Windows source tests are recorded separately when run on this exact head.

This is an additive, scoped sensitive-UI privacy fix, not a comprehensive security audit. Independent model-authored terminal Case, full official server compiler/build, installed Windows application/installer and complete security signoff remain unqualified; release NO-GO.
