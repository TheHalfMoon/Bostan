# B1-100 — Outbound HTTP client identity rebranded to Bostan

Date: 2026-10-31. Strictly PRIVATE, zero-cost and NONPUBLISHING. Exact stacked parent Draft #355 at 0c8fff21f190dde6e1266e2a0d53875dc7fc1bca.

## Observed source identity mismatch

Six first-party Bostan production HTTP call paths still emitted upstream product names inside default User-Agent headers: the DNS-pinned guarded HTTP transport, public GitHub chat attachments, provider billing import (including an unrelated upstream URL), Vercel connector requests, GitHub commit statistics, and GitHub external-object resolution. These values identify Bostan to external receivers and are separate from compatibility identifiers, legal attribution or historical test fixtures.

A **real loopback HTTP transport regression** was changed before modifying the code to require Bostan/1.0 while continuing to respect an explicit caller-supplied Caller/2.0. A separate public GitHub attachment test required Bostan/ChatAttachments rather than the previous upstream identity. Both tests ran **RED before the code fix**, proving old client headers were still emitted through the transport and attachment services.

## Scope-limited implementation

Introduce server/src/services/bostan-user-agents.ts, the single code-owned source for Bostan/1.0, Bostan/ChatAttachments, Bostan/CommitResolver and Bostan/ExternalObjectResolver. Replace default outbound headers only in:
- server/src/services/remote-http-fetch.ts
- server/src/services/chat-github-attachments.ts
- server/src/services/provider-billing-import.ts
- server/src/services/connectors/vercel/index.ts
- server/src/services/github-commit-details.ts
- server/src/services/github-external-object-provider.ts

The guarded HTTP transport still leaves an explicit caller's User-Agent intact, and all original request destinations, authentication, SSL/DNS pinning, redirect policies, body handling, budgets and authorization remain untouched. The original SaaS URL is not claimed as the Bostan website and is removed from the outbound billing header, rather than replaced by an invented domain.

GitHub request regressions now assert the actual Bostan CommitResolver/ExternalObjectResolver headers in mocked fetch calls. Seven new tests enforce the shared first-party string constants and scan exactly the six known production source files to detect legacy egress headers. This scoped source guard is a rebranding regression, NOT proof that every historic upstream identifier in the entire repository has already been migrated.

## Actual validation

Authorized Mac Node26 with existing Vitest5 dependencies and 1 capped test worker:
- **172/172 PASS, zero skipped**, across five suites: DNS-pinned transport (27), GitHub chat attachments (100), commit details (3), external-object provider/service (35), and new outbound identity contracts (7).
- The two original User-Agent expectations were RED before the implementation and GREEN after.
- Targeted strict TypeScript7 ES2023/NodeNext noEmit of the shared Bostan identity module **PASS** when launched from the server workspace, where Node typings are available. A first ad-hoc invocation from the repo root with --types node failed to resolve the Node type definition path. Do not misrepresent that initial invocation as a product error or the entire server typecheck as passed.
- git diff --check PASS. No external provider HTTP requests, no real customer data, no PostgreSQL/Chromium, no dependency install or paid model.

## Explicit rebrand boundaries and remaining work

Do not globally replace upstream skill IDs, package names, existing cloud resource identifiers, Git reference namespaces, backcompat environment-variable keys or names in upstream license/NOTICE/provenance without an explicit migration strategy. Some of those are persisted references whose blind changes could strand user data or break integrations. Full Bostan copy/rebrand qualification remains incomplete. Native Windows installed app/PG/Chrome acceptance, Linux runtime/installers, untrusted-agent sandbox/consent, release security/privacy, licensing/NOTICE/provenance and external cost checks remain **NO-GO**. Repository remains PRIVATE, stacked PR DRAFT, protected main untouched; no GitHub Actions enablement, publication, deployment or customer data.
