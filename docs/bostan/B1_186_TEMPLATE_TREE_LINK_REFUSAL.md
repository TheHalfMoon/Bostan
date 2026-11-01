# B1-186 — Refuse linked and foreign data within PostgreSQL template trees

Date: 2026-11-02 (Asia/Riyadh). Repository: **private** TheHalfMoon/Bostan. Stacked on exact B1-185 PR #443 HEAD `9d61250454f8329ab9ed1e4ca32cd39cd2e2dca2`. **Open Draft, no release.**

## Why this matters

B1-183–185 already reject unowned template directories, missing owner markers, linked `PG_VERSION`, or suspicious `postmaster.pid`. However, the PostgreSQL template cache can contain **deeper** files that are not checked by the shallow test. PostgreSQL consumes configuration, data directories, WAL and tablespaces when the cache is copied and restarted. An owned-stamped cache with a nested `pg_tblspc/...` symlink to another directory, a dangling link, or a `postgresql.conf` hardlink to a file outside the cluster could pass the previous shallow gate. The simple test fixture returned `true` for these malicious entries without verifying their descendants.

## Source change

New isolated source-only module `packages/db/src/embedded-postgres-template-tree.ts` contains `isSelfContainedPostgresTemplateTree(root)`:

- Requires an ordinary, non-symlink directory root and an absolute path.
- Traverses a bounded tree (maximum 16,384 entries, maximum directory depth 32), using `lstatSync` rather than following links.
- Refuses symlinks, hardlinked regular files (`nlink !== 1`), foreign users on POSIX, cross-filesystem entries, sockets/FIFOs/unknown entry types, group/world-writable directories on POSIX, missing or inaccessible entries, and trees over either bound.
- On Windows, does not infer POSIX directory permission bits from Windows `Stats.mode`; native Windows cache remains disabled independently while #234 is open.
- Returns only a boolean, with no untrusted filesystem paths, stack traces or secret-bearing messages.

`packages/db/src/test-embedded-postgres.ts` now incorporates that audit inside the existing ownership-and-stopped-template proof **before cache reuse/pruning**. It additionally audits the **copied** tree after `fs.cpSync` and **before** the embedded PostgreSQL `start()` call, to reduce the chance that a changed source tree is accepted. Rejected templates continue to use fresh-cluster fallback and must not be deleted as foreign or untrusted. There is no foreign process signaling or cache-wide deletion.

### Important limit

This is a bounded, synchronous *filesystem audit*, not an atomic filesystem snapshot. A malicious concurrent actor could still attempt a TOCTOU race between a check and a copy/start; do not claim race-proof isolation, security certification or real PostgreSQL compatibility from these synthetic tests. Future native validation must establish acceptable template scan overhead and actual cache migration reuse on Mac/Linux. Windows template caching is still disabled.

## Actual test-first evidence

A tiny exclusive B206 synthetic-only QA directory was created on Mac. A shallow implementation mirroring the old acceptance gate was run against native real filesystem fixture objects using Node v26 built-in test runner: **4 RED + 3 PASS, exit 1**; failures were nested symlink to an outside directory, nested dangling symlink, nested hardlink shared with outside data, and over-deep tree. Original outside data remained unchanged.

After the bounded recursive guard, native **Mac Node26** full scoped test module: **8/8 PASS, 0 skip, 0 fail, exit0**. This includes the positive ordinary-stopped cluster case and a structural test confirming the actual PostgreSQL fixture invokes the guard on cache admission and again after copying before native start. Targeted TypeScript7 strict `--ignoreConfig --noEmit --strict --skipLibCheck --target ES2023 --module NodeNext --moduleResolution NodeNext --types node` on new helper: **exit0** using preinstalled B135 types.

Independent **Windows 11 Node24.19.0**, exact GitHub file hashes copied to a new exclusive D:\\Bostan-B206-qa minimal, Node `--experimental-strip-types --test`: **5 PASS / 3 SKIP / 0 FAIL, exit0**. The three skipped cases require creating a filesystem symbolic link, which Windows refused with `EPERM` without privilege; test explicitly skips only those cases, not pretending they passed. The ordinary-tree, hardlink, depth and source integration checks passed. Global `postgres.exe` count **0** after test. No actual PostgreSQL was launched, no downloads or paid services, and no other checkouts/processes were affected.

GitHub and independently computed native file hashes from final candidate:
- `embedded-postgres-template-tree.ts`: `11f2f5a246608f02bb62c1ef615a70ccddb59d7b`
- `embedded-postgres-template-tree.test.mjs`: `7608a547d9f176f10034563ed5c82e97ed7f3c1c`
- `test-embedded-postgres.ts`: `36d06d399f1f41d1a23598f127a4d8643644edb8`

## Unqualified release gates

#234 still needs repeated real **native Windows forced-crash `io_worker`** PostgreSQL orphan zero-leak proof, with exact owned process identity. #237 still needs a fully SHA-owned compiled Windows localhost server with synthetic Better Auth bootstrap/roles and Chromium. Full native Mac/Linux template reuse, Windows compiled HTTP, Linux bwrap, installed OS workflows, full root TS7/Vitest, security/privacy/tenant/consent and donor legal provenance are not qualified by this change. Keep **PRIVATE, NO-GO, UNMERGED**, no Actions, release, deployment, paid services or deletion of foreign/retained data.
