# B0-35 — Isolated real PostgreSQL migration, idempotence, backup and restore

2026-10-27. Private, stacked Draft source qualification above B0-34. **Do not merge `main`, deploy, publish, activate inherited Actions or use paid services.**

## Implementation

Added `scripts/bostan-local-postgres-migration-qualification.mjs`, explicit `--run` only. The default `--help` and unknown-argument cases cannot start PostgreSQL. This script uses the local `initdb`, `pg_ctl`, `createdb`, `psql`, `pg_dump` and `pg_restore` binaries, a freshly created scratch data directory under `os.tmpdir()`, an available ephemeral loopback port and distinct role/database names `bostan_verify`/`bostan_qualification`. It overrides `DATABASE_URL` and `PAPERCLIP_CONFIG` **only for child processes**; no existing local cluster, user database, configured Bostan data directory, cloud instance or real user data is touched. Local trust authentication is constrained to temporary localhost only. Ownership marker and `pg_ctl ... stop` verification protect cleanup.

Using the project's **actual** `pnpm --filter @bostan/db migrate` entrypoint, the test boots a blank DB, verifies the first run applies all pending migrations, checks application table and Drizzle migration-journal counts, verifies a second invocation is a no-op, then adds a synthetic probe record in an isolated `bostan_qualification_probe` schema. It takes a real binary-format `pg_dump`, restores it into a separate new scratch DB, verifies journal/table/data roundtrip and invokes the actual migrate command against the restored DB, which must report no pending migrations. Both scratch DBs and server are stopped and discarded after the test.

## Mac execution evidence (PostgreSQL 17.9)

- `pnpm --filter @bostan/db typecheck`: PASS; numbering + migration-safety checks PASS.
- Fresh scratch PostgreSQL before migration: **0 public tables**.
- Bostan first migration: **PASS**, creating **301 public application tables** and **375 recorded migration-journal rows**. The upstream journal JSON contains additional historical entries; the runtime's authoritative post-apply check reports up-to-date. No edits to SQL migrations were necessary.
- Repeated real migration: **No pending migrations**, with unchanged table and journal counts.
- Real `pg_dump -Fc` and `pg_restore`: **PASS**, preserving synthetic record, migration journal and application table counts; restored DB reports **No pending migrations**.
- Scratch PostgreSQL cluster cleanly stopped and temp folder removed; no external services used.
- Existing `src/check-migration-safety.test.ts` and `src/migration-snapshot-drift.test.ts`: **26/26 PASS**.
- New fail-closed CLI/invariant tests: **3/3 PASS**.

## Exclusions

No existing user database was migrated, backed up or modified. Real production data upgrade, cross-version PostgreSQL/macOS/Windows/Linux validation, installed desktop E2E, authenticated server workflows, native Rust daemon, comparative model inference and independent security review remain UNQUALIFIED. No release approval is inferred. **Release NO-GO.**
