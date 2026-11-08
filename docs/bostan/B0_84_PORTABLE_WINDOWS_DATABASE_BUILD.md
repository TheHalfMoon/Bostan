# B0-84 — Portable database migrations and native Windows admission

Private stacked Draft on B0-83 PR #232. No main merge, release, deployment, Actions, paid models or customer data.

## Concrete cross-platform defects

The real @bostan/db build script invoked POSIX-only rm -rf, mkdir -p and cp, so a Windows Command Prompt build cannot bundle migration files. The dedicated PostgreSQL qualification also probed CLI tools with Unix-only which and attempted to run pnpm as a native process (not the Windows .cmd shim). On Windows, the PostgreSQL socket directory flag must not be passed as a Unix domain socket option.

## Repair

- Build script now runs the existing TypeScript migration validators and compiler, then a portable Node helper to package **original, unchanged SQL and journal**.
- Copy helper checks a private @bostan/db manifest, regular owned source files, journal-to-SQL exact parity and migration naming. It refuses symlinked dist/target directories, replaces stale built migration copies, and keeps an old dist snapshot available for rollback until the new build is in place.
- PostgreSQL qualification directly invokes each required PostgreSQL binary with --version, rejects inherited managed Cloud configuration before creating a temporary database, dispatches pnpm via Windows cmd shim only with fixed command tokens, and omits Unix socket flags on Windows. Its existing strict localhost cluster/database cleanup, temporary synthetic records, repeat migrations, archive/restore assertions and no real data remain unchanged.

## Verified results

- Mac ARM64 Node 26: **12/12 focused tests PASS**, including private Cloud admission. Actual pnpm @bostan/db build **exit 0**, actual original SQL/journal **375/375**, no migration source edits.
- Real isolated Mac PostgreSQL **17.9** migration/restore test **exit 0**: fresh scratch database 0 tables, **301 application tables** after **375 migrations**, repeat migration no-op, archive backup and restored data verified, restored journal 375 entries and restored migration no-op. No external services or user records.
- Windows 11 Abdulaziz, Node **24.19.0**, D: isolated checkout: **11/12 focused native tests PASS, 1 platform-specific symlink fixture SKIPPED** (no Windows symlink creation privilege); 0 failures. Real native SQL asset copy **375/375**.
- Frozen scoped install (137 dependency packages) **exit 0**; actual native Windows @bostan/db script (migration validators, TypeScript compiler and portable migration copy) **exit 0** with **375 SQL assets** and unmodified journal.
- Native Windows standalone PostgreSQL CLI admission correctly returned **exit 1** when initdb was not on PATH **before creating any scratch cluster** (0 fixture directories before and after). This is a missing host CLI, not a failed database migration.
- The existing, pinned optional @embedded-postgres/windows-x64 package supplies real **PostgreSQL 18.1 initdb, pg_ctl and postgres binaries** without an installer. Actual native Windows Vitest used Bostan's existing startEmbeddedPostgresTestDatabase helper (not a mocked database). First focused run: **1 selected real DB test PASS, 22 unselected, exit 0**; validated migrated connection pool and idle backend closure. Second focused run: **2 selected real DB tests PASS, 21 unselected, exit 0**; verified real database reset removes stale tables and fresh legacy migration history loads without rewriting receipts. Test durations were ~88s and ~95s including imports/initialization; no model calls.
- Windows embedded PostgreSQL 18.1 left **6 orphaned io_worker child processes** from the ephemeral test harness despite green test completion. This is a separate real Windows **test-process lifecycle issue** and MUST NOT be counted as a cleanup PASS. After tests, all 6 were individually checked against the exact B0-84 owned PostgreSQL executable path and orphan-parent status, stopped with their exact PIDs, and rechecked: **0 B0-84 PostgreSQL processes remain**. The automatic fixture teardown/lifecycle issue remains OPEN for an independent fix before broad Windows test automation. No unrelated PostgreSQL process was stopped.

## Remaining scope

The standalone CLI backup/restore test still needs a full PostgreSQL CLI toolchain including pg_dump/pg_restore on Windows; embedded Postgres 18.1 exposes only the server/core binaries. Full authenticated Windows Bostan backend+browser, signed native installer, real agent task, security/licensing audit and release remain OPEN. No user database, cloud service or paid model used. **Release NO-GO.**
