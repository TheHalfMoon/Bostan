# B1-172 — Refuse hardlinked compiled server/Runner entries

**2026-11-01 Asia/Riyadh | PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO**

Direct parent private Draft PR #428 at exact SHA `d2f4e125009e108af71b10f2ff2e3008f3911a10`. Exact source-and-tests SHA verified on native macOS and Windows: `5e9ff8ed5689ab9325da8cbb5f5bae3f346b7442`.

## Real source fix

PR #428 protected linked compiled parent directories and hardlinked/symlinked `build-info.json`. However, individual **compiled executable files** `server/dist/index.js` and `server/dist/vendor/paperclip-runner/index.js` were only checked for regular-file and non-symlink status. A hardlink to the same inode elsewhere is still regular and non-symlink, and can falsely be treated as an exclusively owned artifact even when its SHA256 matches the build stamp.

Added `nlink === 1` fail-closed admission to BOTH `server/scripts/write-build-stamp.mjs` production build writer's compiled-entry hash step and `scripts/bostan-private-local-compiled-stamp.mjs` private pre-PostgreSQL compiled QA checker. No file deletion, network, process termination, PostgreSQL lifecycle, production HTTP/tenant behavior or release behavior changed. Build stamps remain SHA256-bound and Git-clean provenance constrained.

The tests create **only isolated synthetic owned local Git workspaces and compiled files**. The QA test hardlinks its own synthetic `server/dist/index.js` and vendored Runner to separately named files inside the synthetic workspace and proves refusal; removing each exact test-created hardlink restores admission. The writer Vitest fixture proves each hardlinked compiled entry refuses to stamp and leaves the original known build-info contents unchanged. Existing linked-parent and linked-stamp tests remain unchanged in intent.

## Native test evidence from exact source SHA

Actual authorized existing private full Mac B142 and Windows B111 QA worktrees were clean and temporarily checked out EXACT `5e9ff8ed5689ab9325da8cbb5f5bae3f346b7442`, without cloning or dependency installation. Commands:

~~~sh
node --test --test-reporter=tap scripts/bostan-private-local-compiled-stamp.test.mjs scripts/bostan-local-http-postgres-smoke.test.mjs
# server/ (package-local, with 1152 MiB heap cap)
NODE_OPTIONS=--max-old-space-size=1152 ./node_modules/.bin/vitest run src/__tests__/write-build-stamp.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1
~~~

- **macOS Apple Silicon / Node 26**: private stamp + HTTP smoke admission Node **9/9 PASS, exit0, 540.46ms**; native server writer Vitest 5.0.3 **6/6 PASS, exit0, ~622ms**. Aggregate **15/15 test executions passed**.
- **Windows 11 / Node 24**: private stamp Node **6/6 PASS, exit0, ~2886.17ms**; native server writer Vitest5.0.3 **6/6 PASS, exit0, 3.98 seconds**. Aggregate **12/12 test executions passed**.
- Total **27 test executions green across the two operating systems**, NOT 27 distinct test cases (the same six core stamp tests ran on both). All source and test outputs were from the exact final candidate SHA before the docs-only commit.
- Initial Windows Node regression at earlier candidate SHA failed **5/6 solely because unprivileged Windows refused an existing directory symlink fixture with EPERM**, before reaching the new hardlink cases. Tests were updated to catch **only** Windows `EPERM` for these optional symlink fixtures without elevation, junction fallback, or system changes. Hardlink tests then executed and passed on Windows; symlink-specific negative tests **remain NOT independently proven on this unprivileged Windows device**. Mac did exercise both symlink and hardlink negatives. An initial Windows Vitest attempt was **resource-refused** when free RAM was ~2.31 GiB; a later bounded run with ~5.74 GiB available passed 6/6. Do not call the refused run a pass.

## Cleanup and outstanding blockers

After tests, existing Mac B142 QA checkout restored to **exact original detached SHA `88e0274412c2e6cbadd07534960b20184907f291`**, Git CLEAN and 0 private QA-owned PostgreSQL. Existing Windows B111 QA checkout restored to **exact original detached SHA `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`**, Git CLEAN and native `postgres.exe` process count 0. No global caches, unrelated processes or foreign files touched.

**RELEASE NO-GO:** No fresh compiled server/Chromium application was built or functionally launched. #237 SHA-owned Windows compiled runtime and authenticated Chromium/tenant journeys still OPEN. #234 genuine Windows PostgreSQL forced-crash `io_worker`/multi-worker orphan proof still OPEN. Full server/root TS7/Vitest, rootless Linux bwrap, installed Win/Mac/Linux, user consent/side effects, tenant isolation and legal donor LICENSE/NOTICE/provenance remain unqualified. Keep PRIVATE DRAFT UNMERGED; no Actions, publish/release/deploy, paid providers or customer data.