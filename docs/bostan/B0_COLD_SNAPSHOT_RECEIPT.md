# B0-11 — Private cold backup and new-HOME restore (unqualified)

Status: **implemented in a private Draft branch; not yet runtime-tested**. No publish, release, or merge to main.

## Lineage

- Parent: Draft PR #38, commit `ed807632dcbc233e408035b8a5348a7902426f5a`.
- Working branch: `work/b0-cold-snapshot`.

## Added

- `bostan app backup --local`: requires Bostan-managed config, stopped private PostgreSQL, and absence of a runtime lock. Creates a temporary managed lock to block concurrent application launches while copying the application state, then writes a restricted local snapshot with per-file SHA-256 hashes and a JSON manifest. Partial snapshots are discarded on ordinary errors.
- `bostan app verify --local <snapshot-directory>`: read-only manifest and checksum verification; refuses symlinks, unexpected entries, duplicate or traversal paths, and live runtime markers.
- `bostan app restore --local <snapshot-directory> --into-new-home <absolute-path>`: checks the entire backup before creating a fresh HOME; refuses existing HOME paths and preserves the original profile. Files are rechecked on copying.
- New 13-case offline test suite covers successful snapshot/restore and negative cases such as live PostgreSQL, symlinks, hardlinks, tampering, invalid markers, existing targets and postmaster.pid.
- Existing CLI-only preview test expanded to ensure snapshot commands remain unavailable outside the full source checkout.

## Verification status — important

- **Not executed**: this new cold-backup test suite, because the authorized Mac Remote Desktop Commander reached its monthly usage limit immediately before testing. An attempted remote test call was rejected.
- **Not executed**: full-app restore/relaunch or live PostgreSQL backup for this branch. Do not interpret the existing B0-10 PostgreSQL recovery checks as tests of this new feature.
- Static GitHub file review completed and implementation committed. Tests are authored but their outcome is unknown.
- Before this change, B0-10 regression suite had 34/34 tests passing on Mac for the runtime-recovery code. Those results do not qualify B0-11.

## Threat model and limits

- These are **unencrypted local copies** of the complete application, PostgreSQL database and credentials. They must not be put on public or untrusted storage.
- SHA-256 checks detect data corruption but do **not** authenticate a manifest against deliberate replacement.
- This is a filesystem-level *cold* PostgreSQL snapshot, not an online database backup or a cross-major-version portable PostgreSQL dump.
- Concurrent adversarial filesystem mutation, power interruption, crash recovery in the middle of restore, database version changes and real-world dataset sizes are still unqualified.
- End-to-end app launch after restoring into a new HOME, full agent runs, desktop packages, Windows qualification and egress checks remain open.

## Exact test commands for future qualification

From a fresh working checkout on an authorized development host:

```bash
node --check scripts/bostan-cold-snapshot.mjs
node --check cli/src/bostan-preview.mjs
node --test scripts/bostan-cold-snapshot.test.mjs scripts/bostan-runtime-recovery.test.mjs scripts/bostan-local-runtime.test.mjs
node --test cli/src/__tests__/bostan-preview.test.mjs cli/src/__tests__/bostan-local-install.test.mjs
```

Then conduct disposable HOME end-to-end testing with a real stopped PostgreSQL 17 cluster before trusting a snapshot with user data.

**Release remains NO-GO.** GitHub Actions are still disabled. No release, deployment, package publication or main merge was requested or performed.
