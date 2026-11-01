# B1-163 — Reclaim owned PostgreSQL scratch on pre-start constructor failure

Date: 2026-11-01 (Asia/Riyadh)  
Repository: PRIVATE `TheHalfMoon/Bostan`  
Direct stacked parent: Draft PR #419, exact `d0c9aaeb447f7b3140c97585f27f3f2d537baba2`  
Release decision: **NO-GO**; no main merge, publication, deployment, or GitHub Actions.

## Actual source finding

In `packages/db/src/test-embedded-postgres.ts`, `createEmbeddedPostgresTestInstance()` previously created a fresh temporary directory with `fs.mkdtempSync()` and immediately awaited `createEmbeddedPostgresTestInstanceAt()` without a catch. That latter function allocates a port and loads the embedded-PostgreSQL constructor **before an instance exists**. If port allocation or constructor loading fails, the just-created scratch directory was leaked. This is a test-fixture resource leak, **not** a demonstrated live PostgreSQL orphan or an exploit of production data.

## Scoped code change

Catch only the failure of `createEmbeddedPostgresTestInstanceAt()` before it returns an instance. Verify the scratch path still names the exact original ordinary directory by device, inode and birth time before recursively reclaiming it. If identity is unavailable, changed, or symlinked, fail closed and retain it rather than deleting a possibly foreign replacement. Preserve the original failure after successful owned cleanup. No change to running PostgreSQL shutdown or migration logic.

A new single-file Vitest regression injects a synthetic constructor-provider failure before `initdb`, scopes `TEMP`/`TMP`/`TMPDIR` to an explicitly created test-owned scratch root, asserts the original constructor error, and requires zero leftover child directories. It restores environment variables and cleans only its own marked scratch root.

## Native Windows qualification (real checked-in source)

- Device: owner-authorized Windows 11; Node `v24.19.0`; Vitest `v5.0.3`.
- Existing full clean `D:\\Bostan-B111-qa` checkout initially at detached `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`.
- Before: 5.92 GiB free RAM, 0 `postgres.exe`, clean checkout.
- Fetched and checked out exact proposed test commit `4c19ab29d3777fb7487d4b597b1feb790a6fda18` with hooks disabled.
- Ran from `packages/db`: `vitest run src/test-embedded-postgres-prestart-cleanup.test.ts --pool=forks --maxWorkers=1`.
- **1 test file PASS; 1/1 test PASS; 0 fail; exit 0; Vitest duration 4.70 seconds; complete command session 11.04 seconds.**
- This test does **not** start real PostgreSQL, so no real PostgreSQL cleanup or orphan stress is claimed.
- After: restored the exact original detached QA HEAD `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`, `git status --porcelain` empty, 0 `postgres.exe`. No user data, foreign processes, or unrelated temp files touched.

## Boundaries and remaining blockers

This patch closes the pre-start **empty scratch directory** leak when the constructor or port allocation fails. It does **not** qualify Windows issue #234 forced-crash or multi-Vitest-worker `io_worker` orphan behavior, nor compiled Windows authenticated Chromium issue #237. The prior two real graceful PostgreSQL cycles in #419 remain distinct evidence. Full TypeScript 7 server/root build, genuine unprivileged Linux bwrap, installed three-OS journeys, agent consent, tenant isolation, and legal attribution remain release blockers.

No `main` merge, Actions, release, npm/docs publication, deployment, paid services, customer data, or unowned process/file deletion.
