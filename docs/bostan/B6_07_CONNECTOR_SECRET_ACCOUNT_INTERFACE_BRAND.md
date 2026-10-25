# B6-07 — Bostan operational identity for connectors, secrets, audit and account UI

Private, source-only development. No main merge, release, publish, deployment, Actions or paid model.

## Actual change

The B6-06 follow-up identified inherited previous-product copy in eight active user-facing UI modules: connector vault references, MCP configuration and import, secure OAuth initiation, audit provenance, personal secret references, profile avatar storage, company access policy guidance and browser-use budget descriptions.

These text-only changes say Bostan rather than the previous product identity, including the real user-facing caveats that free-text credentials are disallowed, vault:// references (not secret values) are saved, remote app import remains draft-only until verification/approval, organization boundaries remain enforced, and existing budget limits still apply.

No credential storage, connection authorization, OAuth scope, protocol identifier, upstream test fixture, backend endpoint, billing or behavior was modified. Existing tests containing previous-product names in fixture data or mock server responses intentionally remain unchanged; this update does not misrepresent or rename the actual third-party sources or legally required attribution.

The existing first-party Bostan brand regression includes these eight screens and checks that the secrets and connection safety language is preserved.

## Mac verification — 2026-10-25

- New first-party brand tests: **7/7 PASS**.
- UI Vitest: **48/48 PASS**, five suites covering AuditTab, McpConfigHelpDialog, PasteConfigTab, ProfileSettings and CompanyAccess.
- General Bostan source Node tests: **115 PASS; 9 skipped on non-Windows**, 124 total.
- UI TypeScript check: **PASS**.
- UI Vite production build: **PASS**. Existing large (>500 kB) chunk warnings remain; not a runtime performance qualification.
- Alibaba OCR local delegate preview: **9/9 changed files selected**. This is free static rule/file selection, not a model-based independent code security review.
- Git diff whitespace validation: **PASS**.
- React act(...) state-update test warnings existed but no assertions failed.

## Actual isolated Windows security source check — 2026-10-25

The connected Windows device (Abdulaziz) was checked for a source clone and available capacity, then a private shallow sparse Git checkout of this exact branch was created under the user's Windows TEMP path solely for Node source QA. No large dependencies, PostgreSQL or external paid model were installed.

On native Windows Node v24, the command:

node --test scripts/bostan-windows-acl.test.mjs scripts/bostan-local-runtime.test.mjs

returned **18/18 PASS**, **0 FAIL**, **0 SKIP**. Scenarios include real NTFS DACL apply/verify on a freshly created disposable synthetic .bostan directory, intentional broad ACL injection and fail-closed recovery, rejection of real HOME and non-TEMP paths, refusal of missing/foreign DB executables, disabled inherited telemetry/secrets, UTF8 PG cluster arguments and pre-qualified zero-cost free-provider credential isolation.

**Limit:** This verifies source-only security properties with synthetic files, not actual Bostan app install, browser journeys, real native PostgreSQL, packaged Windows distribution, or full Windows runtime and security qualification. The temporary checkout is to be cleaned after recorded evidence.

## Unqualified release gates

These are source/UI code checks, not a new installed browser E2E, trained model evaluation, independent reviewer, production-like security penetration test or Windows installer sign-off. B4 document/OCR/analytics breadth, B5 real free-model independent review with current saved citations, B6 cross-platform installer/browser and external integration qualification remain open.

The repository remains private, inherited Actions disabled, this work Draft and unmerged. **Release NO-GO.**
