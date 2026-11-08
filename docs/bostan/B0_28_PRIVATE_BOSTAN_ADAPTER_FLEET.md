# B0-28 — Twelve native private Bostan agent adapter packages

2026-10-27. Draft source wave stacked above B0-27. Repository stays private. No merge to `main`, Actions enablement, publishing, deployment or paid cloud/model usage is authorized.

## Implementation

Migrated 12 agent adapter packages from inherited npm identities to private native `@bostan/adapter-*` namespaces: Claude local, Codex local, Cursor Cloud, Cursor local, Gemini local, Grok local, Hermes unified, deprecated Hermes Gateway shim, Kimi local, OpenClaw Gateway, OpenCode local and Pi local. Every converted manifest declares `private: true`, removes inherited public `publishConfig`, points GitHub ownership metadata at `TheHalfMoon/Bostan`, and fails closed on both `prepack` and `prepublishOnly` through the Bostan guard. Deprecated compatibility shim now references the `@bostan/adapter-hermes` workspace package.

Updated imports, workspace manifest dependencies, CLI/server adapter registries, UI use sites, fixtures, GitHub workflow references and documentation. Corrected Hermes Gateway's internal workspace spec. Recreated the pnpm frozen lockfile with exact Bostan workspace importer links. Removed all 12 newly private adapters from the inherited public-release inventory; no package was registered/published. Versioned persisted `paperclip` adapter UI-parser protocol metadata intentionally remains for compatibility, not consumer branding; original license notices are preserved.

## Evidence

- `pnpm install --lockfile-only --offline --ignore-scripts` PASS; `pnpm install --frozen-lockfile --ignore-scripts` for adapter, CLI and server filters PASS (free npm downloads used to replenish missing cache tarballs). The CLI/server runtime was not deployed.
- Built prerequisites `@paperclipai/shared` and `@paperclipai/adapter-utils` successfully for this wave; those two remain legacy names until the next migration wave.
- All **12/12** private Bostan adapter `typecheck` scripts PASS.
- Bostan private adapter identity, disabled release inventory, stable Vitest shard planner and core CLI/server namespace tests: **64/64 PASS**.
- Hermes unified local `vitest run`: **173/173 PASS** with API credentials absent.
- Hermes Gateway shim had an inherited `vitest run` script but no actual tests; added three identity/contract re-export tests, **3/3 PASS**; no fake `--passWithNoTests` exception.
- `git diff --check` and `node scripts/release-package-map.mjs check` PASS.

## Outstanding release gates

Four inherited core package identities remain: adapter-utils, shared, db and paperclip-runner. All 12 adapter packages are private, but the app is not yet qualified end to end. Installed Windows and Linux/desktop app, full server production build, database migration/resume, audited stored plugin-name compatibility, network/security review, and independently authored real-agent Case remain open. This is **not a release-qualification or publication approval**.
