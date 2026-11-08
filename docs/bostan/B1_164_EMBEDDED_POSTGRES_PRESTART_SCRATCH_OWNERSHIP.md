# B1-164 — Own pre-start PostgreSQL scratch on constructor failure

**2026-11-01 Asia/Riyadh | PRIVATE / DRAFT / UNMERGED / ZERO COST / RELEASE NO-GO**

Direct stacked parent: PR #420, exact `185fa43333ac9e10cefee522f24c465d4b96c3c2`. New source/test commit `bd9e46b28e73d28704e531b5b84a328ffcea13f6`. This is a **test-fixture scratch cleanup fix**, not a live `io_worker` forced-crash solution.

## Reproducible source finding

In `packages/db/src/test-embedded-postgres.ts`, `createEmbeddedPostgresTestInstance()` originally called `fs.mkdtempSync()` before awaiting `createEmbeddedPostgresTestInstanceAt()`. The latter allocates a port and resolves the embedded-PostgreSQL constructor before any database instance is available. A rejected port allocation or constructor load escaped without reclaiming the newly created empty scratch directory. It is a bounded local resource leak, not proof of a running PostgreSQL orphan or exposure of production data.

## Narrow code and regression

The fixture now catches failure **only before an instance is returned**, verifies that the newly created directory is still the same ordinary, non-symlink directory (device, inode, birthtime), reclaims only that directory, and rethrows the original failure. On ambiguous/missing/replaced directory identity, it refuses deletion and retains the fixture. Normal database startup, migrations, and post-start stop semantics remain unchanged.

New `packages/db/src/test-embedded-postgres-prestart-cleanup.test.ts` uses the real exported constructor-provider test seam to reject before `initdb`, checks the original synthetic error is propagated, and asserts the test-owned scratch root contains **no leaked child directories**. The test uses a unique marked scratch root, restores `TMPDIR`/`TEMP`/`TMP`, and cleans only its own verified contents. It never starts PostgreSQL.

## Native source qualification

- Owner-authorized Windows 11, Node `v24.19.0`, installed Vitest `v5.0.3`, existing full private `D:\\Bostan-B111-qa` worktree.
- Exact proposed commit `bd9e46b28e73d28704e531b5b84a328ffcea13f6` fetched and checked out detached, Git hooks disabled. The source and test are the exact checked-in Git blobs, not a rewritten equivalent.
- Native command from `packages/db`: `vitest run src/test-embedded-postgres-prestart-cleanup.test.ts --pool=forks --maxWorkers=1`.
- **1/1 real Vitest test PASS, 0 failures, exit 0; test duration 4.75s; complete session 11.28s.**
- Also ran the same exact source/test blob pair on its initial temporary commit `4c19ab29d3777fb7487d4b597b1feb790a6fda18` before the concurrent #420 re-stack: **1/1 PASS, exit 0**. The final qualification above is on the correctly stacked #420 descendant.
- Before final run: approximately 5.87 GiB free RAM, zero `postgres.exe`, original QA checkout CLEAN.
- After final run: original detached SHA `4a367c57e4a40c06dad2befd7de5a6ff43bd6081` restored CLEAN; zero `postgres.exe`. No foreign files/processes, persistent customer data, or unrelated temp paths modified.

## Honest limitations

The native test injects a **synthetic pre-start constructor rejection**. It does not start real PostgreSQL, kill a process, exercise multiple Vitest PostgreSQL workers, or qualify forced-crash recovery. Issue #234 remains OPEN despite the distinct #419 real two graceful migrations and #420 real three-suite single parallel round. Windows compiled/Chromium #237, root TypeScript 7/full Vitest, genuine Linux rootless bwrap, installed three-OS QA, agent consent, tenant isolation, and legal provenance remain release blockers. **NO-GO.**

No main merge, GitHub Actions, release, npm/docs publication, deployment, paid provider, customer data, or unowned file/process deletion.
