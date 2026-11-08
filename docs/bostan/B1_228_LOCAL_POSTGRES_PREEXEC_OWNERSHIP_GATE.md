# B1-228 — Refuse local PostgreSQL commands before original cluster ownership is proved

Date: 2026-11-03 Asia/Riyadh. **PRIVATE / OPEN DRAFT / UNMERGED / RELEASE NO-GO.**

## Real code and safety issue

B1-227 captured the original `mkdtempSync` scratch and marker identities and checked them only in `finalizeOwnedLocalPostgres({ owned })`. The local test migration runner still invoked `initdb -D <cluster>` and `pg_ctl -D <cluster> ... start` **before** the first `owned()` check. Therefore a pre-planted or replaced `cluster` directory could be passed to a destructive database initialization or PostgreSQL startup process, before any ownership refusal. The original cleanup might later deny reclamation, but refusing cleanup does not undo unwanted process operations.

Also, the older B1-225 port-probe structural test was left with a stale source anchor expecting `try { // Port reservation may fail`; B1-226 legitimately inserted socket setup as the first statement in that same try, changing the anchor. This would make the earlier test fail against the stacked source even though the socket and port cleanup scope was retained.

## Implementation

New `scripts/bostan-local-postgres-preexec-gate.mjs` is an isolated, read-only, fail-closed state machine with a one-way refusal latch:

- `beforeInitdb()`: verify B1-227's **original scratch + marker ownership closure** and confirm the cluster path does not already exist, including as an ordinary directory or linked object. Any planted/ambiguous object denies `initdb`.
- `afterInitdb()`: after successful `initdb`, verify the original scratch again and capture the actual new ordinary cluster directory's `dev`, `ino`, `birthtimeMs` and canonical path.
- `beforeStart()`: immediately before the real `pg_ctl start` call, reverify the original scratch and captured cluster directory. Missing, linked or replaced directories deny command execution.
- `ownedForFinalizer()`: the existing finalizer **first** checks the same original identity plus the gate's permanent refusal state. Any failed pre-exec admission denies `pg_ctl stop` or recursive removal of the suspect pathname.

The test-only runner `scripts/bostan-local-postgres-migration-qualification.mjs` now invokes these checks at the corresponding execution boundaries, retaining the prior B1-227 marker check and B1-226 socket/port try/finally. The B1-225 port-probe test has been repaired to assert the new try → socket → port → finally order instead of the stale comment anchor. No production app, schema, credentials or PostgreSQL process manager changed.

## Verified evidence

- **Actual native Linux Node v22.16.0 filesystem tests**: exactly the new GitHub helper + 10-case regression, matching independent `git hash-object` SHA values `2bc9f51d17e18de28f94f9e89c0a5adf5ae0b106` (helper) and `b42267487dcb52648f5b7ce3fe3752b05f6aebd8` (test): **10/10 PASS, 0 skips, 0 fails, exit0**. Cases include safe initial creation; a planted ordinary cluster with real `KEEP.txt` retained; planted symlink target retained; same-path initialized cluster replacement with real `KEEP.txt` retained; linked replacement; invalid original marker/owner proof; partial pre-initdb failure; missing cluster; repeated/out-of-order state; and fixed redacted error text.
- `node --check` for the exact new helper passed.
- Real private GitHub runner source blob `adbff18e4b6c165567491116ac4360c457b0d312` was inspected for ordering: original B1-227 receipt captured before try/socket/port, new gate checked before `initdb`, new initialized cluster captured after `initdb`, gate rechecked before `startAttempted=true` and `pg_ctl start`, and finalizer calls `ownedForFinalizer()` before old copyable-marker/cluster checks.
- The prior stale B1-225 port-probe regression was updated in place to blob `c767335adb4987998663202140271dbd17d77c4a`; the B1-226 socket regression and B1-227 source-order check were also inspected for compatibility with current source.
- Added `scripts/bostan-local-postgres-preexec-integration.test.mjs`, blob `e3f9debd27ec6af29a947f31fadafafc8616bbf7`, to assert the actual runner execution order when checked out as a complete repository. **This full-repository Node integration test was not executed here**, because the exact 11KB runner was not materialized to the isolated local harness. The source ordering was independently verified from GitHub. Do **not** claim full Node test, full TS7/Vitest, native PostgreSQL or actual Windows/macOS qualification.

## Limits and release gates

The read-only lstat/realpath check is bounded temporal evidence, **not an atomic filesystem lease**: a privileged actor could change cluster directories between verification and command invocation. If `initdb` itself fails or a legitimate cluster has uncertain identity, the conservative rule retains suspect scratch; do not forcibly delete without ownership confirmation. The test's original directory and marker provenance is provided by B1-227; this change must stay stacked on that branch.

No Windows Desktop Commander call was made (previous monthly quota was explicitly exhausted; paired status does not authorize bypass). Retained `D:\Bostan-B212-qa` pinned PostgreSQL staging remains unverified and untouched. No real PostgreSQL initdb/server/forced crash, compiled localhost HTTP/Better Auth/Chromium or customer data were used.

Release remains **NO-GO**: #234 repeated genuine native Windows embedded PostgreSQL forced-crash `io_worker` zero orphans + safe teardown, #237 fresh SHA-owned Windows compiled HTTP first-admin/roles/tenant and actual Chromium UI, Linux/macOS real PG, root TS7/Vitest, Linux bwrap, installed cross-OS E2E, security/privacy/consent and LICENSE/NOTICE provenance. Keep private, no main merge, Actions, publish, release/deploy or paid providers.
