# Bostan

**Bostan** is an autonomous-company operating platform for coordinating AI agents, people, tools, knowledge, decisions, and verifiable real-world work.

> **Status: foundation imported; Bostan rebrand and runtime qualification in progress. Not release-ready.**

## Product direction

One founder sets objectives, supervises a CEO / Chief of Staff, delegates work to specialized agent teams, monitors cost and risk, and verifies outcomes from one control plane.

The intended product combines:
- Companies, organizational roles, project goals, tasks, schedules, budgets, approvals, and audit trails.
- Interoperable AI agent runtimes, plugins, governed connections, skills, evaluations, and reusable team templates.
- Bostan Decision Fabric: typed decisions, model routing, uncertainty, calibration, and human escalation.
- Bostan Action Fabric: authorized tool execution, computer use, browser work, provider operations, readback, and effect receipts.
- Bostan Knowledge Fabric: evidence-grounded documents, search, memory, and reproducible analytics.
- Multi-channel founder access and domain adapters, without duplicating external financial, HR, CRM, or support systems of record.

## Current repository state

The complete source baseline is committed on `main`. This is a full code foundation, not an empty scaffold. **Compatibility is not yet validated in the Bostan identity**: internal package names, UI assets, CLI names, environment variables, telemetry behavior, deployment artifacts, and automation still require a coordinated rename and test pass. Do not publish, distribute, or deploy as a finished Bostan build.

See [implementation and migration strategy](docs/bostan/FOUNDATION_AND_MIGRATION.md).

## Development

The imported baseline uses Node.js 24.11+, pnpm workspaces, a React UI, a Node.js API, and PostgreSQL (including an embedded local option). Before the Bostan-specific build is qualified, source-only development can use the existing workspace commands:

```bash
pnpm install
pnpm dev
```

These commands have **not** been verified on this imported Bostan snapshot. Use only a disposable environment with non-production credentials and networking controls. Do not assume the upstream telemetry defaults satisfy Bostan privacy requirements.

## Safety and source rights

Keep original and third-party copyright/license notices where required. Branding and product identity are Bostan; immutable source lineage is maintained in private technical records. Bostan must default to least privilege, no unapproved remote actions, and no unapproved paid providers. GitHub Actions are disabled pending review of inherited workflows.

**Do not create a second company/task/budget authority.** Extend the existing authoritative services through qualified integrations and narrow core patches only when technically necessary.
