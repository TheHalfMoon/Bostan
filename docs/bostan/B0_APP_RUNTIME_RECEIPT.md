# B0-06 — Real localhost source app runtime

Status: **development-qualified on one macOS host**, **not** a release-quality desktop distribution.

## Lineage

- Parent commit: `687021b925fe28f6aed74ef9a6acbf12b6f7322a` (B0-03b Draft PR #31).
- Branch: `work/b0-native-runtime`, stacked on B0-03b.

## Implemented

- `bostan app doctor` runs a read-only source-checkout readiness assessment (Node, Postgres executables, TypeScript loader and Bostan UI).
- `bostan app run --local [--port N]` starts a **source-only** foreground application with local PostgreSQL. Requires Node >=24, built UI, the workspace packages, system PostgreSQL and a clean working environment.
- Generates a private `~/.bostan/app` runtime on explicit invocation, including permissions-limited DB/JWT secrets, PostgreSQL cluster, local configuration, and storage. The database is persistent across restarts.
- Starts PostgreSQL with SCRAM authentication bound to loopback, with its own data directory and a dynamic private port. Does not modify global PostgreSQL services or the legacy application's home directory.
- Spawns the actual existing application server with a tightly scoped environment. Public host binds, inherited model/API credentials, inherited telemetry destination and announcement destination are not passed through. Model egress is not globally proven or blocked.
- Generates the agent JWT secret instead of leaving it missing, checks HTTP `/api/health` for readiness, forwards Ctrl+C and stops both server and PostgreSQL on clean shutdown.
- Server startup error banners use the Bostan name. Internal module/DB/adapter dependency names remain under migration.
- The installed preview CLI from B0-03b **still refuses** application commands because it cannot yet bundle the complete server/UI/dependencies.

## Tests and observed behavior (2026-10-24)

- `node --test cli/src/__tests__/bostan-preview.test.mjs cli/src/__tests__/bostan-local-install.test.mjs scripts/bostan-local-runtime.test.mjs`: **21/21 passed**.
- `pnpm install --frozen-lockfile --ignore-scripts`: passed; inherited generated-binary warnings.
- `pnpm --filter @paperclipai/plugin-sdk ensure-build-deps`: passed.
- `pnpm --filter @paperclipai/ui build`: passed with a nonfatal chunk-size warning; returned the Bostan frontdoor UI.
- System PostgreSQL binary: 17.9 (Homebrew), Mac Apple Silicon. The legacy embedded-PostgreSQL bootstrap failed in isolation, but **the isolated installed PostgreSQL 17 route succeeded**.
- Manual isolated-source smoke: fresh private PostgreSQL data cluster + `bostan` runtime server started on loopback and 375 schema migrations applied. **HTTP 200** from `/` and **HTTP 200** from `/api/health`.
- Repeat smoke with the same private home/data: **HTTP 200** from both endpoints again; a clean SIGTERM shutdown left no app-run lock or PostgreSQL `postmaster.pid`.
- Temporary test locations only: `/tmp/bostan-runtime.csBwOP`. No Bostan app was installed to the user's actual home.
- GitHub Actions remain disabled. No release, merge, CDN or package publishing.

## Not yet validated

- Production installer / packaged app / Windows/macOS GUI launch flow.
- Auth/onboarding and real agent model execution, paid-provider interactions, collaboration and original Olax fabric features.
- Full browser E2E, concurrency, power-loss/crash restart, database backups/restores, unsafe symlink race stress tests, resource limits and entire inherited test suite.
- Complete egress audit and zero third-party outbound guarantees. Local host can still contact chosen providers once features are configured.
- All remaining imported branding and required historical attribution. Retain licenses and legal notices.

**Release remains NO-GO** until separate end-to-end, privacy, packaging and security qualification is complete.
