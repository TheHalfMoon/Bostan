# B0-03b — Native isolated preview CLI installer

**Status: implemented and locally tested on macOS; NOT a complete Bostan application installer, deployment or release.**

## Exact provenance

- Parent branch: `work/b0-privacy-defaults`
- Parent commit SHA: `5484491ca181d8552fdb7cd0d54aed8bbc78f5c1`
- Branch: `work/b0-native-local-install`

## Functionality

- `bostan --help` / `--version`: read-only.
- `bostan status`: read-only inspection of a dedicated Bostan CLI install and SHA-256 payload digest.
- `bostan install --local`: explicit local-only source/package install on macOS and Linux. Creates a managed, hash-addressed preview-CLI payload within `~/.bostan/cli/versions`, with a small, standalone dependency-free `package.json`. Creates `~/.local/bin/bostan` **only when the path is unoccupied**. Never touches existing `~/.paperclip` or prior product service paths.
- Existing identity, package scope, telemetry settings and runtime of the imported source are not used by the new preview command.
- Install refuses symlinks/unexpected files/foreign ownership in the managed path, existing commands, incomplete install locks, altered manifests and modified payloads. Writes use exclusive creation and a SHA-256 integrity check.
- All operations outside the preview installer and status, including server runtime, service, CLI updater, rollback and remote installer, remain refused.
- `cli/package.json` has `prepack` and `prepublishOnly` pointing at the disabled Bostan release gate. Real npm packaging and publishing remain prohibited. **`npm pack --dry-run --ignore-scripts` is merely a file inventory, not evidence of publishability or dependency closure.**

## Verification performed

1. `node --test cli/src/__tests__/bostan-preview.test.mjs cli/src/__tests__/bostan-local-install.test.mjs` — **17 / 17 passed** on macOS.
2. `pnpm --filter bostan build` — **passed**.
3. Invoked `bostan install --local` with an isolated temporary HOME, executed installed shim, verified status and version, and confirmed a sentinel in temporary `~/.paperclip` remained intact.
4. Copied the preview CLI to an independent temporary staging tree, installed from it, deleted the staging directory, then executed installed shim — **passed**.
5. Negative tests include existing bin collision, symlinked data root/bin/shim, tampered installed payload, held install lock, and attempts to run old update/onboard/service commands — **passed**.
6. Test for directory paths containing both whitespace and apostrophes — **passed**.
7. `npm pack --dry-run` from `cli/` — **intentionally blocked** by prepack guard. `npm pack --dry-run --ignore-scripts --json` returned expected file inventory: LICENSE, README, dist/bostan.js, dist/bostan-local-install.mjs and package.json.
8. `git diff --check` — **passed**.

## Limitations and next gates

- **This installs the Bostan CLI preview only.** It cannot run the Bostan server, database, company dashboard or AI agents.
- Not yet qualified on Windows, across multiple concurrent processes, against adversarial filesystem race conditions, or within a fully sandboxed and monitored egress environment. No broad claim of installer security certification.
- Native Bostan app data root, migration of existing imported-code environment variables, user service integration, server launch, database migrations, backups, full test suite and production package dependencies remain **unqualified**.
- GitHub Actions remain disabled, branch remains a Draft PR, no merge to main and no release authorization.
