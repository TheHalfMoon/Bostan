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

## Native Windows source qualification and independent PostgreSQL fixture blocker

At exact commit 9a5ac47aac78e1107ddfded01d36762c871a6e8a, Windows 11 B144 QA had 5.26GiB free RAM, 11.90GiB free on D: and no PostgreSQL before admission. Its five-suite native Node24/Vitest5 run returned **EXIT 1**, not PASS: **156 tests PASS, 16 skipped**, plus one failing suite because the external-objects-service real embedded PostgreSQL beforeAll fixture **exceeded the original 20,000ms hook timeout**. The remaining non-PostgreSQL checks ran, but this is a genuine Windows fixture qualification blocker. Do not claim 172/172 PASS on Windows or lower safety gates to disguise it.

A separate native Windows rerun intentionally excludes only the PostgreSQL-dependent external-objects-service suite and checks the four source contracts (transport, attachment, commits, outbound identity). Its result will be recorded only after the process finishes with a verified exit code. Neither the original partial result nor a focused run establishes a packaged Windows product release.

### Scoped native Windows no-database regression — PASS

Using the exact same Windows checked-out source commit 9a5ac47aac78e1107ddfded01d36762c871a6e8a, with 4.69 GiB free RAM, 12.11 GiB free D: and zero pre-existing PostgreSQL, reran four native Windows Node24/Vitest5 source suites that do **not** start PostgreSQL. Real loopback guarded transport 27, GitHub chat attachments 100, GitHub commits 3, and identity source/constant contracts 7: **137/137 PASS, zero skipped, EXIT 0** in 64.84 seconds. The DNS-pinned real loopback test explicitly proves Bostan/1.0, and an explicit Caller/2.0 remains unchanged. All four suites are qualified on the native Windows source checkout, but the distinct external-object embedded PostgreSQL hook remains RED and the packaged app release remains NO-GO.
