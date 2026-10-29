# B1-21 — compiled Bostan workspace closure

Date: 2026-10-29. PRIVATE stacked Draft on B1-20 PR #273 at `bfbb3da8113cbf333d38674a0a94692f50ce01c4`. No main merge, Actions, publishing, deployment, package release, paid inference or customer data.

## Real native Windows reproduction

The compiled runtime bundler's default workspace inclusion rule only recognized the legacy `@paperclipai/` namespace. The current Bostan database package exports `bostan-compiled: ./dist/index.js` and `default: ./src/index.ts`, but the esbuild resolver was configured with `conditions: ["node"]`. As a result, a compiled runtime could externalize `@bostan/db` and defer its resolution to Node's source/default entry instead of embedding the built JavaScript.

In an owned native Windows 11 Node 24.19.0 fixture, a synthetic `@bostan/db` package provided a built `dist/index.js` with `value=42` and a default source entry that throws. The exact B1-20 parent source produced a real esbuild bundle but its plain Node subprocess failed to load the compiled value: **RED 0/1 passed, 1/1 failed as expected**, with `@bostan/db` left as a bare external import. This is a concrete compiled-runtime failure, not a static assertion.

## Source change

- Include the Bostan workspace scope `@bostan/` in the default bundle-internal rule, preserving existing legacy compatibility.
- Enable esbuild's `bostan-compiled` condition alongside `node`, selecting built JS for conditional Bostan exports.
- Keep unrelated third-party packages external. Do not alter authentication, PostgreSQL ownership, process cleanup, release flags or installer paths.

## Native evidence

A fresh, marker-owned `D:\\Bostan-B121-qa` checkout was detached at the exact PR #273 head, with isolated `D:\\Bostan-B121-temp`. Offline frozen pnpm installation with `--ignore-scripts` succeeded (803 packages, no downloads or lifecycle scripts). The existing B111 checkout was not modified.

- Real Windows Node 24.19.0 `node --check` for production source and new test: **PASS**.
- `node --test server/scripts/bundle-runtime-compiled-workspace.test.mjs`: **2/2 PASS**, 0 fail, 0 skip.
- The compiled `@bostan/db` test renames the entire synthetic package away **after** esbuild finishes, then runs `server.mjs` with plain Node: `B121_COMPILED=42` PASS without source or runtime workspace package.
- A separate third-party fixture updates its package from value 1 to 77 after bundling and runs plain Node: `B121_EXTERNAL=77` PASS, proving ordinary external resolution is preserved.
- `git diff --check`: **PASS**.
- The pre-existing Vitest `bundle-runtime.test.mjs` suite on this native Windows account ran **5 PASS / 5 FAIL**: four tests require a symlink privilege unavailable here (`EPERM`), and one asserts a POSIX `file:///srv` URL despite native Windows drive-root semantics. These are **not green** and must not be reported as qualified or attributed to this patch without a separate baseline comparison.

## Outstanding qualification

This verifies a real synthetic compiled-workspace dependency path and the third-party external boundary, **not** the full Bostan server build, HTTP readiness, Windows 18-stage authenticated PG/HTTP, multi-suite zero-orphan proof (#234), Chromium, live zero-cost agent, macOS, installers, or independent security/licensing/backup/recovery. Nested Runner `check:protocol-coverage` `d:` error remains unproven/unfixed. Issue #237 remains open. Release remains **NO-GO**.
