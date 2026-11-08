# B0-36 — Real Bostan server readiness on disposable localhost PostgreSQL

2026-10-27. Stacked Draft above B0-35; no `main` merge, publication, deployment, inherited Actions activation or paid API/model use.

## Scope

Added an explicitly opt-in `scripts/bostan-local-http-postgres-smoke.sh --run`, derived from the proven local development harness. On macOS/Linux/WSL where PostgreSQL CLI binaries are available, after filtered pnpm workspace dependencies and `@bostan/plugin-sdk`/`@bostan/runner` TypeScript builds, this starts a *fresh* disposable PostgreSQL cluster with a loopback-only listener and dynamically selected port. It creates `bostan_qualification`, applies the **actual** `@bostan/db migrate` command, and runs `server/src/index.ts` through preinstalled `tsx` with a separate localhost HTTP port, separate `PAPERCLIP_HOME`, nonexistent separate `PAPERCLIP_CONFIG`, disabled Bostan feedback export, no external model credentials or OTel export URL. All owned server and Postgres processes are stopped and scratch data removed via `EXIT` trap. It never touches the operator's actual Bostan data directories or PostgreSQL instance.

The test polls actual `GET /api/health` until `bootstrapStatus === 'ready'` (HTTP 200 can precede readiness), then validates `status: ok`, `deploymentMode: local_trusted`, `deploymentExposure: private`, `authReady: true`, and `bootstrapStatus: ready`. No UI interaction, agents, external inference, paid services or production database is accessed.

## Evidence

- `@bostan/db migrate` applied successfully to freshly initialized PostgreSQL 17.9.
- **Real server process** started and reported HTTP 200 plus health fields: `status=ok`, `local_trusted`, `private`, `authReady=true`, `bootstrapStatus=ready`. First source-typed probe failed while checking an optional nested `serverInfo.startupRecovery` field not present in the shortened live health response; test corrected to use the authoritative root `bootstrapStatus` contract and reran **PASS**.
- Fresh scratch server and Postgres both stopped; directories removed. No external model provider called.
- Opt-in fail-closed and local-only source contract checks: see `scripts/bostan-local-http-postgres-smoke.test.mjs`.

## Open gates / observed follow-up

Existing startup banner still displays a donor-era ASCII logo and `npx paperclipai onboard` guidance. This is visible product identity debt requiring an explicit follow-up without altering legal attribution or versioned protocols. Native Rust daemon, installed Windows/Linux/macOS UI flows, authenticated application end-to-end, pre-existing database upgrades, security and independent external review remain unqualified. **Release NO-GO.**
