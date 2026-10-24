# B0-10 — Local PostgreSQL crash-recovery safety

Status: development-only verification. No release or publication.

## Source lineage

Parent B0-08b Draft PR #37, commit 9ca8de3157e177718b073910147cb95ac318d11e. Private work branch: work/b0-runtime-recovery.

## Changes

- The previous local runner always deleted its run.lock file even if PostgreSQL shutdown failed. This could leave a live database without a runtime lock.
- New scripts/bostan-runtime-recovery.mjs verifies lock ownership, safe file type, permissions, live/stale owner PID and the private database state.
- A live process, EPERM, unknown PostgreSQL state, active PostgreSQL, malformed lock, symlink, or group-readable lock causes a refusal.
- pg_ctl status must report exit code 3 to prove an initialized private PostgreSQL cluster has stopped. Running exit code 0 and unknown statuses retain the lock.
- The regular launcher no longer removes the lock until the database stop is independently verified. Failed start and failed shutdown are handled conservatively.
- The source CLI now has an explicitly invoked command: bostan app recover --local. It deletes only a verified stale Bostan lock; it does not touch database contents, other app installations, or provider services.
- The installed CLI-only preview still has no app runtime capability.

## Tests and evidence

- Actual macOS checkout of the B0-10 branch at 993fe8e195ff17ddb760632dacaffb79eeae54a0.
- Node syntax checks for runtime, recovery, CLI: PASS.
- Node unit tests: 17/17 PASS (13 new recovery checks and 4 existing source-runner checks).
- Real PostgreSQL 17 under a disposable home directory: stale lock recovered after a verified stop; recovery refused with PostgreSQL running and retained the lock; then PostgreSQL was stopped and the lock cleared successfully.
- Adjacent inherited-app sentinel file was preserved.
- No real user home directory was modified.

## Open qualification gates

- Full app startup/shutdown E2E after this exact commit, abrupt crash/power-loss stress, PID reuse races and backup/restore qualification.
- macOS/Windows packaged desktop installation, complete data/egress audit, actual first-agent model execution and full end-to-end workflows.
- No public release, artifact distribution, deployment or store publication is authorized.
- GitHub Actions remain disabled and main unchanged. Release NO-GO.
