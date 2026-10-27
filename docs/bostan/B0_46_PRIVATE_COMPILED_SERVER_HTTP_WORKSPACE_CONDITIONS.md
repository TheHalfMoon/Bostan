# B0-46 — Real compiled JavaScript server HTTP admission and explicit private workspace exports

**Date:** 2026-10-27. **Source baseline:** private `TheHalfMoon/Bostan`, stacked Draft #194 at `9717ab35588e1c39cf3382f5f20f0bd677d86652`. Keep repository **PRIVATE**, GitHub Actions **DISABLED**, release **NO-GO**, no merge into `main`, no publication/deployment, no paid model providers, no customer data.

## Real packaging failure reproduced, not inferred

The original private server's `start` script ran `node dist/index.js` while many first-party workspace package `exports` still pointed to `./src/*.ts`. On authorized macOS arm64, built `server/dist/index.js` failed at the actual Node module loader, before HTTP startup:

1. `@bostan/db` resolved to `packages/db/src/index.ts`, which tried to import a nonexistent `src/client.js`.
2. After repairing DB/shared compiled resolution, `@bostan/adapter-codex-local/server` tried to import a nonexistent `src/server/execute.js`.
3. After resolving first-party adapter compiled JS, the built server next required adapter-owned non-TypeScript `codex-auth-merge-extract.sh` from `dist/server/`, and then the **375 SQL migration files** under DB `dist/migrations/`. These are part of the existing actual production build recipes, but absent from a plain `tsc` emission.

These are genuine built-JavaScript startup failures; previous source/TSX HTTP success did not prove compiled artifact startup.

## Change

- Added explicit **`bostan-compiled` Node conditional exports** for the Bostan DB, shared runtime, 11 server-consumed agent adapters, adapter-utils and skills-catalog. The ordinary/default exports still target the existing TypeScript sources, so prior source runtime, tests and developer workflows remain unchanged. The historical versioned/wire protocol identifiers and mandatory legal attribution are preserved.
- Private server `start` now invokes `node --conditions=bostan-compiled dist/index.js` rather than expecting Node's unconfigured ESM loader to resolve `.ts` workspace source. `--run-dist` was added as a separately explicit mode of the existing disposable, real Postgres+HTTP source smoke, and it fails without the three required compiled build roots rather than silently falling back to TSX.
- Added `scripts/bostan-private-compiled-server-http-qualification.sh`: side-effect-free `--plan`, explicit `--run` only on macOS/Linux, 2 GiB minimum free-space admission, local prerequisite checks, strips cloud credentials and disables telemetry; **offline-only workspace JavaScript compilation** (not the heavy release-mode Rust build), copies source-owned SQL and adapter/helper assets according to the already existing package build recipes, validates runner vendor dependency closure, writes an actual Git commit build stamp and reuses the source-owned ephemeral PostgreSQL/HTTP smoke. No network installs, publish, release, live models, or user-HOME writes.
- Added source export resolution/CLI safety tests. Prior `scripts/bostan-local-http-postgres-smoke.test.mjs` changed only to allow and verify the new explicit built mode.

## Executed qualification on real Mac

Frozen filtered workspace dependencies were installed with `pnpm --offline --frozen-lockfile --ignore-scripts --filter '@bostan/server...'` (0 downloaded). The first-party JS, helper and vendor assets were built from that private checkout. **The following actual command exited 0:**

```bash
bash scripts/bostan-private-compiled-server-http-qualification.sh --run
```

It used **`node --conditions=bostan-compiled dist/index.js`**, not `node --import tsx src/index.ts`, and served an **actual HTTP 200** at `/api/health` against a newly initialized standalone local PostgreSQL cluster. Checked response fields: `status=ok`, `authReady=true`, `bootstrapStatus=ready`, `deploymentMode=local_trusted`, `deploymentExposure=private`. Verified active terminal Bostan banner and absence of obsolete donor onboarding command. The smoke then cleanly stopped owned processes and deleted synthetic/temporary Postgres and HOME data. `BOSTAN_BUILT_SERVER_LOCAL_HTTP_QUALIFIED` and `BOSTAN_PRIVATE_COMPILED_SERVER_HTTP_ACCEPTANCE_PASS` were both emitted.

The legacy/default source smoke was executed independently afterwards and **also exited 0**: actual PostgreSQL migration, HTTP 200 and correct readiness under `node --import tsx src/index.ts`. This is proof the compiled condition did not break the existing source path.

Relevant manifest/identity/adapter/database/branding/HTTP safety tests: **32 PASS, 0 FAIL, 0 SKIP**. This includes four new export and private offline admission tests. Shell syntax and `git diff --check` passed. The original server TypeScript `--noEmit` check experienced severe Mac memory/swap pressure and an external stop signal and is **not** counted as an independently qualified compiler check. The repeatable QA deliberately uses TypeScript `--noCheck` for *emission only*; it is **not a substitute for a full typecheck**.

## Remaining blocks

This validates the Mac **compiled-source-workspace server** from `dist`, not an independently installable or packaged distribution outside the checkout: Node dependencies, compiled first-party workspace assets and local PostgreSQL are required. A full bundled/installable Mac/Windows/Linux artifact, clean complete server typechecking under sufficient RAM, Windows native GUI/application lifecycle, Linux Rust/native integration, real free-model governed agent evaluation, and independent security review remain **UNQUALIFIED**. Release **NO-GO**, no merge into main.
