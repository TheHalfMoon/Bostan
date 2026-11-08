# B1-221 — Isolate libpq environment in disposable PostgreSQL QA

## Source-backed defect
The B1-220 runner constructed `isolatedEnv` by spreading `process.env`, then overwrote `PGHOST`, `PGPORT`, `PGUSER`, and `PGDATABASE`, but removed only four credential/service keys. Ambient `PGHOSTADDR`, `PGOPTIONS`, and other libpq `PG*` settings remained. PostgreSQL documents that when both `host` and `hostaddr` are specified, `hostaddr` determines the server network address; therefore `-h 127.0.0.1` alone is insufficient to exclude an inherited remote `PGHOSTADDR`.

Official references:
- https://www.postgresql.org/docs/current/libpq-connect.html
- https://www.postgresql.org/docs/current/libpq-envars.html

## Change
- Introduce `buildIsolatedLocalPostgresEnv` to remove all case-folded inherited `PG*`, `DATABASE_URL`, and `PAPERCLIP_CONFIG` entries without printing their values.
- Pin `PGHOST` and `PGHOSTADDR` to `127.0.0.1`, the ephemeral port, synthetic user/database, and scratch-local config.
- Pass the same isolated environment to `initdb`, `pg_ctl start`, `pg_ctl stop`, and all existing client/migration/backup/restore operations. Restore operations inherit this environment and override only their synthetic target database.
- Reject invalid projector inputs with a fixed diagnostic. Preserve B1-220 uncertain-start scratch retention and ownership checks.

## Evidence (2026-11-03, isolated Linux Node 22.16.0)
- Test-first missing-helper import: expected RED, exit 1.
- New helper tests: **7/7 PASS**, 0 skipped, exit 0.
- `node --check` on new helper and test: PASS.
- Local `git hash-object` matched GitHub blobs:
  - helper `b74b3ad80dc877c0b38683c5b74c4170b207be15`
  - tests `6b7676108a96af8a9322834da4e59010cba61bf5`
- Runner integration checked for exact source substitutions and pinned environment on initdb/start/stop; full runner test and actual PostgreSQL **not run**.

## Remaining limitations
This is a libpq environment boundary, not an atomic process/ownership attestation. Ambient non-PG variables are still forwarded where needed by local tooling. No genuine PostgreSQL, Windows forced-crash #234, installed Windows auth/Chromium #237, or installed Windows/macOS/Linux E2E occurred. **RELEASE NO-GO.** No foreign process was terminated; retained Windows QA assets were not accessed.
