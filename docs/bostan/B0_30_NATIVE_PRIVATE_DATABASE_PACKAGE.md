# B0-30 — Bostan database npm ownership, migration schema preserved

2026-10-27. Source-only draft stacked above B0-29. No release, deployment, cloud/paid model, database alteration, public repository mutation or inherited CI activation.

Converted the database npm package `@paperclipai/db` to native `@bostan/db`. Its manifest is private and cannot be npm-packed/published, inherits no public `publishConfig`, and points at `TheHalfMoon/Bostan` for code ownership. Replaced exact package import/dependency strings in 1,473 owned active tracked files, mainly server TypeScript tests/routes, also CLI and workspace build metadata. Regenerated the pnpm lockfile offline. Removed the package from the public-release manifest entirely while leaving all remaining entries disabled.

**Persistence safety:** source `packages/db/src/migrations/**` SQL files, `_journal.json`, Drizzle snapshots and historical data fixtures remain byte-identical; this wave performs no SQL schema rename, live migration, reset, seed or database write. The existing versioned data/wire keys intentionally remain until an audited compatibility migration.

## Evidence

- Filtered frozen offline pnpm install for private DB/server: PASS.
- DB official `typecheck`, which first runs migration numbering and safety scans: PASS.
- DB official `build`, including compiled TypeScript and read-only copied SQL migrations: PASS.
- Drizzle snapshot drift and migration safety Vitest suite: **26/26 PASS**.
- Bostan database private package/inherited release guard test, release-package map and product identity: **22/22 PASS**.
- Release inventory static check and `git diff --check`: PASS.

## Open gates

`@paperclipai/paperclip-runner` is the final identified inherited core npm identity. Installed Windows app, a complete tested build of the Bostan server/UI, real local DB startup/replay/restore, model-authored independent Case evaluation, transport/security signoff and compatibility with previously stored data remain to qualify. No final product readiness is asserted. **Release NO-GO.**
