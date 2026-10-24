# B0-29 — Isolated real PostgreSQL feedback tests and server typecheck

**Private Bostan development, not release qualification.** October 24, 2026, macOS arm64.

## Previous blockers

- The imported `embedded-postgres` image failed to start on this macOS host;
  the feedback service suite registered **17 skipped tests**, including the
  upstream-feedback-queue quarantine test introduced in B0-26.
- Whole-server TypeScript failed with missing generated
  `@paperclipai/paperclip-runner` declarations and downstream type errors.

## What changed

`server/src/__tests__/helpers/bostan-postgres-test-backend.ts` provides a
**test-only, explicitly opt-in** backend for the feedback service suite:

- `BOSTAN_TEST_POSTGRES_BACKEND=system` selects the locally installed `initdb`
  and `pg_ctl` executables; the default continues to use the original embedded
  database harness. The binaries can instead be pointed at by the optional
  absolute `BOSTAN_TEST_POSTGRES_BIN_DIR` directory. Missing binaries and
  relative paths are refused before launching a cluster.
- Generates a cryptographically unpredictable temporary directory using
  `mkdtemp` in the system temp folder; restricts permissions to `0700`;
  initializes an independent PostgreSQL data directory. No existing database,
  PostgreSQL service, `PGDATA`, `DATABASE_URL`, production volume, or user
  configuration is ever modified, dropped, or reset.
- Binds PostgreSQL to loopback on an ephemeral port, with trust authentication
  **only for this temporary process**. Never use this setting for production.
  Creates the `bostan_test` database and applies normal project migrations.
- Closes registered client connections and stops the isolated cluster on
  cleanup; deletes only the exact temporary directory created by `mkdtemp`.
  If a process still runs after a failed stop, it refuses to remove live data.
- No changes to production DB logic, schema, auth, or feedback dispatch.

## Executed verification

- Real PostgreSQL 17.9 via Homebrew, not a fake/mock: **17 of 17
  `feedback-service.test.ts` database-backed tests passed**, including B0-26
  quarantine of `paperclip_labs_feedback_v1` pending exports. Test database
  directory and process were verified absent after cleanup.
- Focused database and privacy combination, with the isolated backend:
  **41/41 PASS** over 5 Vitest files. Includes three new explicit opt-in/
  fail-closed tests, feedback config, HTTP transport and Express vote route.
- Built the TypeScript-only Runner and eval-kernel dependencies using:

  `pnpm --filter @paperclipai/paperclip-runner build:typescript`

  **PASS**. `dist/index.d.ts` and `dist/live/index.d.ts` exist locally after
  generation. No Rust release binary or external service was built here.
- Whole server TypeScript:

  `pnpm --filter @paperclipai/server exec tsc --noEmit --pretty false`

  **PASS (exit 0)** after Runner declarations were generated.
- `git diff --check`: **PASS**. No remote uploads or paid services.

## Reproduction

On macOS/Linux with a locally installed PostgreSQL `initdb` and `pg_ctl`, run
in a disposable development checkout, **not** against any existing service:

```
BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/feedback-service.test.ts --maxWorkers=1
pnpm --filter @paperclipai/paperclip-runner build:typescript
pnpm --filter @paperclipai/server exec tsc --noEmit --pretty false
```

## Not yet qualified

- The imported embedded PostgreSQL library remains broken on this Mac, so
  its default test flow may still skip. The optional isolated system backend
  is a verified workaround for the feedback suite, not a general cure for
  all PostgreSQL test suites.
- The tests were run on macOS only. Windows installation, full Runner Rust
  release build, native executable cold start, actual UI/browser E2E, full
  source-wide telemetry review, remote Bostan Cloud broker and release
  qualification have not been completed by this wave.
- B0-26 through B0-29 remain stacked, unmerged private Draft PRs. Existing
  tests and generated source compatibility labels are not a release-ready
  rebrand. **RELEASE NO-GO.**
