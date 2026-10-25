# B6-05 — Bostan identity in assistant connection, experimental settings and recorded costs

**Private development PR. No main merge, publishing, deployment, paid cloud or release.**

## Changes

- MCP assistant connection screen was already showing Bostan, but the inherited tests were still checking previous-product copy. Reconcile the real tests with the actual Bostan user-visible text and retain the existing MCP scopes and approval controls untouched.
- Rebrand developer-mode text, descriptions and accessibility labels while preserving the original persisted enablePaperclipDeveloperMode flag until a storage migration is qualified.
- Keep all experimental setting cards sorted by visible title after the name changes. This fixes an existing UI acceptance invariant that initially detected the card order regression.
- Present Bostan, not inherited donor identity, in costs overview service fallback and Muse usage/budget warning. Does not imply unsupported spend enforcement or provider billing support.
- Preserve truthful Managed by Paperclip Cloud labels on actual inherited hosted-management policy rows, rather than misrepresenting a third-party control as an available Bostan Cloud service.

## Tests performed

- Focused assistant MCP consent, experimental settings and costs UI: **112/112 Vitest PASS** over three suites. The first run exposed a settings card sort regression; fixed before final qualification.
- Bostan brand/protocol compatibility Node tests: **5/5 PASS**.
- UI TypeScript typecheck and production Vite build: **PASS**. Existing Vite large-chunk warnings are open; no speed claim derived from the build.
- No online AI model or paid provider involved.

## Open gates

More visible copy and inherited hosted/connector terms need policy-aware inventory, and API compatibility keys remain intentionally unchanged. Full self-contained local installer, browser/Windows E2E, B4 analytics, B5 live model-backed JSON current-source verification / canonical Case completion, independent security audit and release readiness remain NO-GO.

**Do not publish.**
