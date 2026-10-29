# B1-20 — Windows compiled-runtime drive-root path integrity

Date: 2026-10-29. PRIVATE stacked Draft on B1-19 PR #272, exact parent `bc79604f68f2d97e3604f2ccc4c0afa483c30623`. Protected main unchanged. No publication, deployment, merge, Actions, paid inference, or customer data.

## Reproduced production defect

The parent `server/scripts/compiled-runtime-entry.mjs` accepted Windows rooted-but-drive-less paths such as `\\rooted\\private.mjs` and `/rooted/private.mjs`. On native Windows, `node:path.isAbsolute()` considers these absolute, but `pathToFileURL()` resolves them against the current drive. This silently changes the caller's intended file identity. The old UNC-only guard did not cover the single-rooted form.

The exact parent GitHub blob `c08e4c4a0e46503c81626af5008290741aa75ab1` was copied byte-for-byte into an isolated, marker-owned Windows fixture and verified with `git hash-object`. A real Node 24.19.0 subprocess test required both `nativeEsmFileUrl` and `compiledRuntimeEntrySource` to reject drive-less rooted paths: **RED 0/1 PASS, 1/1 FAIL as expected** (missing expected exception).

## Production fix and verified tests

On Windows, the compiled-runtime helper now requires an explicit drive-rooted local path (`X:\\...` or `X:/...`) in addition to `isAbsolute`. UNC, device namespaces, drive-relative and root-relative paths fail closed with the existing generic error; valid drive-rooted paths still produce file URLs. Linux behavior is unchanged. No loader bypass, auth changes, or source fallback were introduced.

- Exact source GitHub blob after fix: `3fb126e0fb0a34d12d4b8de91f32aa4e734fc5e5`.
- Exact committed regression GitHub blob: `4dbecfe2fc0f1f618837953f5900a14fb0c0c341`.
- Native Windows 11 Node 24.19.0: `node --check` on both changed modules **PASS**.
- `node --test compiled-runtime-entry.test.mjs windows-rooted-path.test.mjs`: **7/7 PASS**, 0 fail, 0 skipped. The additional independent red/green test remains a temporary owned fixture, not a repository file.
- The parent B1-19 esbuild source-bypass test and full Bostan compiled build were **not rerun** in this wave.

## Separate Windows Runner build-sequence investigation

In fresh isolated `D:\\Bostan-B120-qa`, cloned read-only from B111 at `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`, frozen offline pnpm `--ignore-scripts` installed Runner 390 packages and later server-scoped 413 packages. Five actual sequential Runner steps passed in the owned checkout: `check:protocol-manifest`, `build:typescript`, `check:capability-contract`, `check:capability-inventory`, and `check:protocol-coverage`. The direct and root-filtered `check:protocol-coverage` also passed read-only on B111. **The separate nested server-recursive `ERR_UNSUPPORTED_ESM_URL_SCHEME` drive-letter failure was not reproduced or fixed.** No full server build was claimed.

At the first Windows preflight: ~2.79 GiB free RAM, C: ~8.64 GiB free, D: ~16 GiB free, Node 24.19.0 and pnpm 9.12.0. During isolated Runner sequence the free RAM remained at least ~2.3 GiB in observed samples; PostgreSQL, Chromium, live HTTP and agents were not started. Mac remained offline. All files created in owned B120 paths; original B111 checkout remained read-only.

## Outstanding gates

B1-20 improves compiled runtime file identity validation only. The full compiled Bostan server, nested Runner recursive build, Windows 18-stage authenticated HTTP, multi-suite PostgreSQL zero-orphan proof (issue #234), Chromium Playwright, first zero-cost agent, native Mac, installers, and independent security/licensing/backup/recovery are **NOT qualified**. Issue #237 remains OPEN; overall release **NO-GO**. Preserve Bostan brand and all existing license/NOTICE files.
