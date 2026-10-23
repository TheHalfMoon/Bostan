# Bostan — Foundation and Migration Strategy

**Decision (2026-10-24):** Bostan is the canonical new product. Start from a complete copy of the Paperclip source tree; do not design or implement a second company orchestration kernel from scratch. Treat Olax as an architecture and requirements donor, **not** a second concurrently developed company platform.

## Verified source admission

- New private repository: `TheHalfMoon/Bostan`.
- Source repository: `paperclipai/paperclip`, default branch `master`.
- Pinned imported source commit: `2e38649341815fa7f58195e2fa60e2e89e72e4ce`.
- Tracked source paths copied: **11,833**. The new Git history starts with a snapshot commit rather than importing upstream development history.
- Imported-source commit on Bostan: `2bedb09cb20a66fbb9725080a97f7358987e54f1`.
- Original license file retained. Rebrands do not erase required author/license notices.
- No runtime test, TypeScript build, dependency installation, release or security certification has been performed for Bostan at admission.
- GitHub Actions disabled at repository level to prevent unknown inherited CI expenditure and side effects until reviewed.

## Olax disposition

Olax: `TheHalfMoon/Olax` (private). Keep it unchanged. Its canonical v2 foundation strategy selected complete Paperclip-derived product reuse and proposed **one authoritative writer** per company, task, finance, HR, CRM, knowledge, action, and decision domain. Olax's design work is not equivalent to an implemented, qualified product. Its W0 preparation may have advanced after its older README; reconcile exact current commits/issues before migrating any status claim.

Adopt Olax's most valuable decisions:

1. One founder-facing CEO / Chief of Staff controls delegation across specialist agents.
2. A governed **Decision Fabric** supplies typed, auditable recommendations, not unchecked authorization.
3. An **Action Fabric** performs real authorized work across computer, browser, CLI, APIs, and remote systems, with machine policy, readback, and unknown-outcome reconciliation.
4. Evidence-grounded **Knowledge and Analytics** maintain scoped source lineage, reproducible calculations, and controlled memory assertions.
5. No duplicate truth: foundation company/task/run IDs are authoritative; external finance, HR, CRM, and support providers remain canonical for their own transactions.
6. Independent completion gate: a worker cannot self-certify an effectful task as done without trusted, exact-state evidence.

Do not move Olax's documents or implementation state automatically. Import only reviewed compatible contracts to `docs/bostan/` and new Bostan extension packages; link each source decision to the implementation PR.

## Copy-first build sequence

### B0 — Identity, privacy, and reproducibility
- Audit every executable, workspace, package scope, CLI name, UI string, asset, URL, API path, environment variable, database migration, container/service name, documentation link, and release workflow containing inherited branding.
- Replace product-facing names with Bostan; handle internal stable identifiers through compatibility aliases or versioned migrations rather than blind search/replace.
- Disable inherited usage telemetry by default. Remove or explicitly replace external service endpoints, auto-update hooks, and release/publishing automation.
- Review source licenses, assets, bundled data, secrets and default credentials; keep required notices in non-marketing legal records.
- Run baseline install/build/typecheck/unit/UI/API tests and local boot with a pinned toolchain. Document exact receipts and regressions.
- Establish `bostan` CLI/build/package identity only once dependency graph and installer compatibility are understood.

### B1 — Preserve and harden the working core
- Preserve companies, board identities, goals, projects, issues, heartbeats, budgets, reviews, organizations, roles, skills, teams, and adapters.
- Test company isolation, authorization, scheduler races, crash/restart, budget exhaustion, approvals, and secrets scope.
- Enforce reliable, non-bypassable completion qualification and action dispatch before enabling privileged workers.

### B2 — Bostan Decision Fabric
- Typed decision cases, model profiles, calibration and abstention, cost caps, local-first routing and evidence records.
- Prefer optional plugins with namespaced storage; no competing issue, agent or task scheduler.

### B3 — Bostan Action Fabric
- Governed MCP, web automation, desktop Computer Use, file edits and API operations.
- Compose company approval with machine consent: only the stricter effective policy permits an action.
- Durable operation IDs, side-effect receipts, state readback and idempotent reconciliation of ambiguous outcomes.

### B4 — Bostan Knowledge and Analytics
- Local-compatible OCR/document intake, retrieval, provenance, memory lifecycle, deterministic data tools, and verifiable output artifacts.
- Enforce company scoping, deletion propagation, prompt-injection containment and bounded computation.

### B5 — Real autonomous company slice
- Founder -> CEO -> specialist team -> authorized tool -> real output -> independent verifier -> evidence-linked CEO summary.
- Demonstrate duplicate requests, worker crash, stale permission rejection, budget fence, unknown effects and a successful resume.
- Reuse Olax's previously defined 24-company scenario oracles where compatible and independently requalify them against Bostan.

### B6 — Polished product and controlled release preparation
- Fully consistent Bostan branding, onboarding, local/default offline profile, installation/updates/rollback, docs, accessibility and browser/mobile UX.
- Produce SBOM/notices, tests, security review, packaging receipts and feature matrix.
- **Do not publish or release unless separately instructed.**

## Acceptance gates

- Source completeness: every tracked path in the pinned baseline was copied; omissions and new changes are recorded.
- Identity: **zero old product-brand references in shipped UI, website, installer, CLI, package registry identity, user docs, assets and user-visible errors**, except legally required notices.
- Engineering: reproducible install, compilation and tests; migrations safe; runtime works without upstream SaaS endpoints.
- Privacy: no default outbound telemetry, credentials exfiltration, or unapproved hosted inference.
- Autonomy: real effects require policy, bounded costs and trusted completion.
- Product: clearly better value than a basic task board, not a rebranded static dashboard.

## Current limits

**The source is copied, but the full rebrand, installs, build, tests, and Olax fabric implementations are not completed.** Follow this ordering; never mark a wave complete just because the source already contains similarly named components.
