# B1-227 — Capture original local PostgreSQL scratch and marker identity before teardown

Date: 2026-11-03 Asia/Riyadh. **PRIVATE / OPEN DRAFT / UNMERGED / release NO-GO.**

## Source-backed destructive-cleanup bug

The local PostgreSQL migration qualification runner `scripts/bostan-local-postgres-migration-qualification.mjs` allocated a scratch folder with `mkdtempSync` and wrote the copyable `BOSTAN_OWNED_DISPOSABLE_CLUSTER` marker. Its teardown `owned()` callback only checked that the **current** pathname was an ordinary directory, its marker was an ordinary file with the same text, and the current `cluster` directory was ordinary/canonical. It did **not** compare the current physical directory or marker against the filesystem object allocated by this run.

**Real isolated Linux filesystem reproduction:** Move the original scratch to another name, create an unrelated ordinary folder at exactly the same pathname with the exact same text marker and an ordinary `cluster` subdirectory, and write `KEEP.txt`. Using the exact current parent repository `scripts/bostan-local-postgres-cluster-ownership.mjs` blob `52ad97d6d1b696a370606a74f7114a4eaba6472d` in the source's former `owned()` logic, the **replacement incorrectly passed**. Had normal removal followed, `rmSync(ephemeral,{recursive:true,force:false})` would have attempted to delete that unrelated directory. The replaced KEEP file was not deleted during this regression.

## Specific change

New standalone dependency-free test-only `scripts/bostan-local-postgres-scratch-identity.mjs` captures, immediately after `mkdtempSync` and writing the owned marker:

- Canonical absolute owned scratch path under the OS temporary directory, with the explicit generated `bostan-pg-qualification-` leaf pattern.
- `lstat` identity (`dev`, `ino`, `birthtimeMs`) of **the original directory AND the original ordinary single-link marker**, plus fixed marker content, canonical paths and size.
- A read-only closure that, at each teardown ownership check, refuses missing/replaced/symlinked/hardlinked/modified marker or scratch objects with a bounded, path-free failure; it never creates, removes or signals anything.

The real runner imports the helper and captures the receipt before socket creation and port reservation. In the existing fail-closed `finalizeOwnedLocalPostgres({owned})` callback it executes `if (!originalScratchOwned()) return false` **before** the previously present marker, path and cluster checks. The existing finalizer declines `pg_ctl stop` and removal if ownership is unverified, and rechecks the same receipt after a confirmed stop.

This fix is not an atomic guarantee against a privileged concurrent path swap *after* the final check. It does not certify nested cluster file contents or replace actual native PostgreSQL orphan-process proof. It is a genuine defense against a **completed replacement already present at verification time**, not a claim of comprehensive race-free teardown.

## Verified tests

- Actual isolated Linux Node **v22.16.0** on exact GitHub source helper `105ce0f79c14e2b146dd7dae716aaefd0477af26` and its committed 9-case regression file `33c887dbfcb26d35cef00263aa34336a9105a968`: **9/9 PASS, 0 skip, 0 fail, exit0**. Covers ordinary original, replaced same-name clone with KEEP retained, copied marker, symlink and hardlink marker, linked root replacement, missing marker, malicious inputs and bounded diagnostics, altered marker size.
- A separate executed one-case baseline `6dc9897ab6e204b0ed92b68c392b5f2021992097` using exact GitHub cluster-ownership helper `52ad97d6d1b696a370606a74f7114a4eaba6472d`: **1/1 PASS**, proving former copied-path/matched-marker acceptance versus new original-inode refusal, while retaining the cloned `KEEP.txt`.
- **Combined 10/10 PASS**, Node syntax check PASS. Independent native `git hash-object` checks in the test container exactly matched the helper, nine-case test, baseline test and prior cluster helper GitHub blobs.
- The actual modified runner is `scripts/bostan-local-postgres-migration-qualification.mjs`, blob `380667ae2f08db6c4abf9da2bdfe080556c7e685`. Connector source inspection verified the capture occurs after marker write and before fallible socket/port work, and that the finalizer checks it ahead of former marker and cluster checks. A committed three-case source contract `scripts/bostan-local-postgres-scratch-identity-integration.test.mjs`, blob `16c9435a539cba9b98d5d008016a9d17640b2367`, is available for a **future complete checkout test run**; it was **not executed in Node locally** because the complete runner was not materialized. This is structural evidence, not native PostgreSQL execution.

No PostgreSQL CLI binaries, frozen pnpm workspace, compiled HTTP app or browser are installed in the isolated container. No Windows Desktop Commander calls were made. The earlier remote provider monthly-use warning was not bypassed, and previously retained `D:\Bostan-B212-qa\native` was not inspected, changed or deleted.

## Release gates

The repository remains **private, NO-GO, unmerged**. Critical #234 repeated real Windows PostgreSQL 18.1 deliberate forced-crash + zero orphan `io_worker` process-tree proof without any foreign kills, #237 clean exact-SHA installed compiled Windows HTTP+Better Auth signed-in session, first-admin, tenant/role authz and real Chromium E2E; native Linux/macOS PostgreSQL template support, full root TypeScript7/Vitest, Linux sandbox, installed Win/Mac/Linux app, privacy, security, consent and donor LICENSE/NOTICE provenance are not qualified. Never merge, enable Actions, publish, deploy or use paid services without those gates.
