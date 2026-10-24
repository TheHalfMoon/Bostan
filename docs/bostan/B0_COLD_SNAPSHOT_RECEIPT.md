# B0-11 — Bostan local cold backup and verified restore

**Status: development-qualified on one macOS host with PostgreSQL 17; not release-ready.**
Parent: Draft PR #38 (`ed807632dcbc233e408035b8a5348a7902426f5a`).
Branch: `work/b0-cold-snapshot`. No release, deployment, or merge to main.

## Scope

- `bostan app backup --local`: a local **cold** snapshot of the Bostan-managed application directory and private PostgreSQL data. Refuses a running/unknown PostgreSQL, an active Bostan run lock, unsafe files, symlinks and hard links. Uses a temporary Bostan lock to serialize with local application launch.
- `bostan app verify --local <backup>`: validates the manifest, per-file SHA-256, file inventory, ownership/type, and absence of running markers.
- `bostan app restore --local <backup> --into-new-home <absolute-home>`: verifies before copying; refuses existing target home, a target inside the snapshot, unsafe paths, and external launcher-managed paths. Copies only to a new private home, then rebases **known launcher-owned** database-backup, logging, storage, and secret-key file paths to the restored home. The original app and snapshot remain intact.
- Source-only functionality. The isolated installed CLI-only preview continues to refuse these operations.

## Verified on Mac — October 24, 2026

1. `node --check` for the backup implementation and preview CLI: **PASS**.
2. Unit tests for cold backup, runtime recovery and source-runtime guards: **34/34 PASS**.
3. CLI and installed preview safety tests: **17/17 PASS**.
4. **Real PostgreSQL 17** on an isolated temp HOME: rejected backup while active; after shutdown backed up and verified **1,309 entries**; restored into a new HOME; rejected a second overwrite; started the restored PostgreSQL cluster, queried a test table, and confirmed the expected row; no original-HOME references remained in managed config.
5. **Real Bostan full application** on an isolated temp HOME: installed source dependencies, built UI, passed `app doctor`, started local server with its private PostgreSQL and **HTTP /api/health 200**. Created the organization `Bostan Restore Evidence` via its real API. Stopped server and PostgreSQL; backed up and verified **3,420 entries**. Restored to a different temp HOME, restarted Bostan against the restored PostgreSQL, verified **HTTP 200** and the same organization's ID and name via the live API, then stopped it cleanly.
6. Verified **no stale Bostan runtime lock or PostgreSQL postmaster.pid** after the final app stop.
7. All tests used private, disposable local profiles. Neither real user HOME nor other applications were touched.

## Security, compatibility and release gaps

- Snapshots contain **unencrypted application secrets and potentially sensitive data**. Do not move them to public/untrusted storage. SHA-256 detects corruption, not malicious manifest replacement.
- The snapshot is a filesystem-level PostgreSQL cold copy (not a portable SQL export), and is not qualified across operating systems or PostgreSQL major versions.
- Full recovery under power loss, concurrent adversarial filesystem mutation, repeated backups of larger datasets and multi-process stress remain open.
- Path rebasing covers only the explicit launcher-owned config keys; arbitrary absolute paths in application database content, user agent instructions, or plugins are not rewritten.
- Full desktop installers for macOS and Windows, executable agent/model run validation, comprehensive egress review and signed distributables remain release blockers.
- The tests above are focused macOS development evidence, not approval for production storage or general release.

**Release: NO-GO. Do not publish, deploy, package for distribution, or merge to main.**
