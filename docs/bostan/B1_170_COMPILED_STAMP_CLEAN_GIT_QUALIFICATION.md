# B1-170 — Refuse compiled Bostan QA from a dirty Git checkout

**2026-11-01 Asia/Riyadh | PRIVATE / ZERO COST / DRAFT / UNMERGED / RELEASE NO-GO**

Direct parent: private PR #426 exact HEAD `39d36d507e1a704e4d97b27d6ec039982677f8e4`. Exact source and test commit qualified natively on two OSes: `0e2161bb56ca3ceb66990bd5a1562dca1b8f0e5e`.

## Risk and narrow repair

B1-168 and B1-169 already verify the compiled server's `build-info.json` Git commit and matching SHA-256 values of `server/dist/index.js` and the vendored Runner entry, before any private localhost PostgreSQL fixture is created. These checks still returned PASS if a checkout had **modified tracked source files or newly added untracked files** while `git rev-parse HEAD` remained identical. A dirty source tree can invalidate a claim that a compiled artifact corresponds to the exact committed source.

Now `scripts/bostan-private-local-compiled-stamp.mjs` additionally runs local read-only bounded `git -C <repo> status --porcelain=v1 --untracked-files=normal` before hashing compiled entries, and requires **empty output**. Git-ignored generated build assets remain excluded as intended; other tracked/untracked changes fail closed. A Git invocation error or output that exceeds the bound also refuses admission. No mutation, network request, process kill, build, or PostgreSQL startup is performed by this check. The compiled SHA, exact Git HEAD and build-info checks remain mandatory.

New regression extends the existing actual synthetic Git checkout test: initializes its own temporary Git repository, commits a synthetic README and `.gitignore` for `server/dist/`, writes its own synthetic SHA-bound executable entries and manifest, proves admission PASS, then proves refusal for (a) changed tracked README while HEAD is unchanged and (b) an untracked nonignored source file. It also confirms readmission after exact restoration, and retains prior executable-byte, Runner-byte and wrong-SHA refusals. Temporary directory created by the test is the only directory recursively removed by the test.

## Actual native Mac and Windows proof

On an already existing, owner-authorized **macOS Apple Silicon** full B142 QA checkout, Node v26, original detached SHA `88e0274412c2e6cbadd07534960b20184907f291`, clean, temporarily checked out exact private candidate source SHA `0e2161bb56ca3ceb66990bd5a1562dca1b8f0e5e` and ran:

~~~sh
node --test --test-reporter=tap scripts/bostan-private-local-compiled-stamp.test.mjs scripts/bostan-local-http-postgres-smoke.test.mjs
~~~

**Mac PASS: 9/9 tests, 0 fail/skip, exit 0, 1204.96 ms total** (all tests from two checked-in test files, including private localhost Cloud environment isolation negative tests). No app/PG started.

On pre-existing owner-authorized **Windows 11** full B111 QA checkout, Node v24, original detached SHA `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`, clean, fetched/checked out the same exact candidate source SHA and ran:

~~~powershell
node --test --test-reporter=tap scripts/bostan-private-local-compiled-stamp.test.mjs
~~~

**Windows PASS: 6/6 tests, 0 fail/skip, exit 0, 2191.35 ms total** (Windows-native exact Git fixture including clean/dirty and executable digest admissions). The Bash localhost smoke tests were not run on Windows, and are not claimed to have run there.

Aggregate **15 green test results across the two systems**, not 15 distinct cross-OS tests. Resource-aware and purely offline; no Rust, TS full build, Chromium, paid providers, customer/production data, global cache deletion, or database process termination.

## Independent restoration and release boundary

After tests, restored Mac B142 EXACT original detached SHA `88e0274412c2e6cbadd07534960b20184907f291`, Git CLEAN, zero checkout-owned PostgreSQL processes. Restored Windows B111 EXACT original detached SHA `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`, Git CLEAN and zero native `postgres.exe` processes. No changes to main, shared caches or unrelated files/processes.

This is a **fail-closed source-provenance admission qualification**. It does **NOT** prove the freshly compiled current server works, nor that the source checkout can be trusted against malicious reflashing/re-stamping. Real Windows compiled/Chromium journeys issue #237, forced-crash `io_worker` orphan/repeated stress issue #234, full server/root TypeScript7/Vitest, genuine Linux unprivileged bwrap, installed Windows/macOS/Linux apps, consent/side-effect/tenant/legal provenance remain **RELEASE NO-GO**. Keep PRIVATE DRAFT unmerged; no publish, Actions, deployment, paid cloud or real-user data.