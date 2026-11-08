# B1-31 — Exclusive compiled-runtime build lock

Date: 2026-10-29. Repository `TheHalfMoon/Bostan` remains **PRIVATE** and strictly **NONPUBLISHING**. Exact stacked parent: B1-30 Draft PR #283 at `e4be2e6f6ff6ea20f2538b56847c9d31c2167930`. Do not merge, publish, deploy, release, pack, enable GitHub Actions or use paid services.

## Source-backed problem

B1-27–B1-30 introduced compiled runtime prebuild, SHA-256 owner manifests, same-volume staging/rollback and next-build crash recovery. However `buildAndCommitCompiledRuntime` lacked cross-process exclusion. Two concurrent calls targeting the same `runtime` or `dist-runtime` could both qualify the same old output, race staging/renames/ownership checks, and interfere with rollback or leave a missing/mixed runtime. In this project, a safe failure is preferable to two simultaneous mutations of one directory.

## Change

`server/scripts/bundle-runtime-lock.mjs` defines `withExclusiveRuntimeBuildLock`:

1. Calls existing source and output path admission; requires an absolute canonical target.
2. Atomically creates a dedicated sibling `.bostan-<output-name>-build.lock` via Node `open('wx', 0o600)` (exclusive create). It never opens an existing lock for writes, follows a lock symlink, steals or guesses a stale lock, or deletes an unexpected lock.
3. Writes a fresh cryptographic 256-bit random ownership token, then runs the operation. The lock covers **recovery, compilation with esbuild write:false, staging, promotion, owner marker creation and verified backup cleanup**.
4. On success or failure, closes the owned file and removes its path *only if* current `lstat` identity matches the original device/inode, the file remains regular/non-linked, and exact token and file size match. Modified/replaced locks are preserved, fail closed.
5. Rejects concurrent invocation before executing its build callback; separate recognized output directories have separate lock names.

The existing `buildAndCommitCompiledRuntime` imports and uses the lock helper for the whole critical section. The helper does not treat PID metadata or wall-clock timestamps as authority to delete an existing lock.

## Tests actually executed

Isolated Linux Node.js **v22.16.0** synthetic system-TEMP fixtures, with the exact source and new test Git blobs committed to GitHub:
- `bundle-runtime-lock.test.mjs`: **7/7 PASS** — happy path and release, error release, simultaneous contender rejected without calling its callback, existing stale lock kept, symlink-to-foreign sentinel preserved, modified owned lock retained, independent targets isolated.
- `bundle-runtime-build-lock-integration.test.mjs`: **2/2 PASS** — production `buildAndCommitCompiledRuntime` holds the lock throughout compiler callback and actual filesystem promotion, blocks the second build; a failed compilation releases lock and retains the previously built runtime.
- Combined with local pre-existing B1-27/B1-28/B1-30 regression fixtures in the isolated work directory: **34/34 Node tests PASS**, 0 FAIL, 0 SKIP; `node --check` PASS.

Exact blob parity (locally executed and GitHub):
- production helper `478ae93f990ecd963ca7b18ae2da1a2bda97380d`;
- helper regression tests `9dc7d313eb8a6bdcca990f39988af31a663da85e`;
- integration regression tests `ee2cc8af79bfa3bd948db6d9c511e42f79ef33c9`;
- patched production build wrapper `2bcc67cf7b62716999706c43e89e6b9ba33813b3`.
No real customer files/services or process termination were involved.

## Failure modes / NO-GO

A power loss leaves the exclusive lock file in place. This is intentionally **fail-closed**; there is NO automatic stale-lock theft, PID-based expiry, or implicit removal. A qualified operator must independently ensure no build is running before safe manual stale-lock handling. This may postpone B1-30's next-build recovery until the lock is deliberately cleared, but avoids racing a live writer.

Cross-process exclusion depends on filesystem-exclusive create semantics: this Linux synthetic test does NOT prove NTFS junction/rename behavior, remote filesystem behavior, hostile TOCTOU attacks, crash recovery after Windows power loss, or production-grade atomic swaps. No full compiled Bostan app build, real Windows PostgreSQL/18-stage authenticated HTTP (#237), broad orphan proof (#234), Chromium, Mac, installer or genuine offline free agent tested in this wave. Both authorized Desktop Commander devices were OFFLINE at the wave's preflight.

Release remains **NO-GO**, repo private, GitHub Actions OFF, no main merge/publish/deploy/release/npm pack, paid models or customer data.
