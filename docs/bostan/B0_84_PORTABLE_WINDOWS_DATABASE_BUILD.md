# B0-84 — Portable database migrations and native Windows admission

Private stacked Draft on B0-83 PR #232. No main merge, release, deployment, Actions, paid models or customer data.

## Concrete cross-platform defects

The real @bostan/db build script invoked POSIX-only rm -rf, mkdir -p and cp, so a Windows Command Prompt build cannot bundle migration files. The dedicated PostgreSQL qualification also probed CLI tools with Unix-only which and attempted to run pnpm as a native process (not the Windows .cmd shim). On Windows, the PostgreSQL socket directory flag must not be passed as a Unix domain socket option.

## Repair

- Build script now runs the existing TypeScript migration validators and compiler, then a portable Node helper to package **original, unchanged SQL and journal**.
- Copy helper checks a private @bostan/db manifest, regular owned source files, journal-to-SQL exact parity and migration naming. It refuses symlinked dist/target directories, replaces stale built migration copies, and keeps an old dist snapshot available for rollback until the new build is in place.
- PostgreSQL qualification directly invokes each required PostgreSQL binary with --version, rejects inherited managed Cloud configuration before creating a temporary database, dispatches pnpm via Windows cmd shim only with fixed command tokens, and omits Unix socket flags on Windows. Its existing strict localhost cluster/database cleanup, temporary synthetic records, repeat migrations, archive/restore assertions and no real data remain unchanged.

## Evidence / limitations

- Mac Node 26: portable 375-SQL asset copy and 375 journal entries verified; 9/9 focused unit tests PASS, including output byte parity, stale cleanup, identity denial, symlink denial, cloud/source contracts and default-inert qualification.
- Full native Windows source tests, actual TypeScript build and real PostgreSQL execution: to be verified and recorded separately. Do not treat source-based tests as real database validation.
- Postgres is not installed in Windows PATH on the current authorized Windows host; an actual native Windows DB-backed end-to-end remains OPEN unless genuine native PostgreSQL becomes available. Bostan release NO-GO.
