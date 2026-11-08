# B1-189 — Bounded PostgreSQL test-template logical copy size

Date: 2026-11-02 Asia/Riyadh. **Private / Draft / unreleased / unmerged / NO-GO.**

## Scope and actual defect

B1-186 bounded the cached PostgreSQL test-template directory tree by the **number of entries and directory depth** but did not bound logical byte size. A stale or adversarial **owned** template containing one gigantic relation or many individually valid files could pass and be copied, consuming excessive disk/IO. Existing template checks run before cache reuse and again on the copied cluster before `instance.start()`. This is not an atomic filesystem snapshot and does not by itself prove safe operation under a concurrent race.

## Change

The direct test-only cache audit `packages/db/src/embedded-postgres-template-tree.ts` now refuses:

- Any ordinary file whose logical `Stats.size` exceeds **256 MiB**.
- A cluster where the sum of file sizes exceeds **512 MiB**.
- Invalid/unsafe sizes; normal link/owner/permission/entry-count/depth validations remain.

A rejected cache is retained and existing code falls back to creating a fresh independent PostgreSQL cluster. No native PostgreSQL process deletion or global filesystem cleanup is added. Windows **template caching remains disabled** until #234's forced-crash orphan qualification.

## Actual test-first evidence

Native Linux Node22 built-in test runner, real small synthetic cluster directory fixtures plus **sparse files with large logical size but minimal allocated bytes**. The exact GitHub B1-186/B1-188 base source blob `11f2f5a246608f02bb62c1ef615a70ccddb59d7b`, reproduced locally at identical git hash, ran the same suite: **9 pass / 3 fail, exit1**. The three failed cases had 256 MiB+1 byte single file, 512 MiB+1 total bytes, and 3 × 200 MiB individual files; all were incorrectly accepted.

The repaired source byte-for-byte matches the previously verified B1-187 source-only blob `64b6256caada40505cc12cdfab0c6dddf6417e76`. With identical test fixtures: **12/12 pass, 0 skip, exit0**. Positive boundaries at 256 MiB single-file and 512 MiB aggregate passed; small/nested cluster and foreign hardlink/symlink noninterference, POSIX group-writable-dir, and missing root checks also passed. All test-specific scratch directories were removed by their test cleanup hooks. No paid service, customer data, models, native DB or remote PCs used in these Linux tests.

Unlike previous **source-only B1-187 branch**, this independently reviewable stacked Draft branch includes both source and regression test:

- Source `packages/db/src/embedded-postgres-template-tree.ts`: `64b6256caada40505cc12cdfab0c6dddf6417e76`.
- Tests `packages/db/src/embedded-postgres-template-size.test.mjs`: `fb56d0acb2dca62b7c7e0bb01e4ee5c07403ab14`.

Do not claim real native PostgreSQL template caching or Windows sparse-file test success: the 5 large sparse-file tests are **intentionally marked skipped on Windows** to avoid unbounded physical allocation; the Linux native suite ran them all.

## Release gating

Overall **NO-GO**: #234 actual Windows bounded forced-crash `io_worker` no-orphan proof; #237 fully installed SHA-owned compiled Windows HTTP Better Auth/signup/admin/tenant roles + Chromium; actual native Mac/Linux PostgreSQL template reuse and disk budget benchmark; full root TypeScript7 and native Linux bwrap; installed cross-OS app, privacy/consent/tenant/security and donor LICENSE/NOTICE. No main merge, publishing, deployment, paid/cloud provider or foreign data/process cleanup.
