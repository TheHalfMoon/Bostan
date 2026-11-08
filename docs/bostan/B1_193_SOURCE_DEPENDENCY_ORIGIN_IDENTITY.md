# B1-193 — Fail-closed physical origin and identity for source HTTP QA dependencies

Date: 2026-11-02 (Asia/Riyadh). **Private Draft engineering; NO-GO for release.**

## Reproduced failure mode

Issue #237's previously attempted **native Windows source HTTP test** created and migrated a real synthetic PostgreSQL fixture but failed later because the scoped Node dependency `smol-toml` was missing in a borrowed/incomplete workspace. The old `scripts/bostan-private-windows-source-workspace-admission.mjs` only tested whether `createRequire(package.json).resolve('smol-toml')` succeeded in each of three workspaces (`server`, `packages/adapter-utils`, `packages/paperclip-runner`). It was possible for that to resolve through an ancestor-hoisted package or a symlink into a *different* checkout. An attacker could also supply a different package under a directory named `smol-toml`; Node resolution alone does not prove its installed manifest identity.

These conditions were reproduced using **actual isolated Node22 filesystem fixtures**, including real module resolution and symlinks. No user working checkout or PostgreSQL was modified in these tests.

## Change and expected behavior

The test-only source HTTP dependency preflight now:

- Requires a canonical absolute non-symlinked isolated checkout root and each workspace's own **real** `node_modules` directory.
- Requires a *direct* `node_modules/smol-toml` package entry for each of the three declared workspaces, not merely a successful ancestor-hoisted resolver result.
- Requires the physical package and the module file loaded by Node to resolve **within the same owned QA checkout**, and the loaded module file to reside **inside the direct package's physical directory**.
- Verifies the physical package's own ordinary, nonlinked, bounded-size `package.json` exists and explicitly declares `name: "smol-toml"`. Refuses missing, mismatched, symlinked, malformed, and oversized package manifests, without echoing package paths, credentials or errors.
- **Accepts legitimate pnpm virtual-store symlinks** when they resolve to the same checkout's `node_modules/.pnpm`. This is deliberately not a ban on all dependency symlinks.
- Continues to fail before creating disposable PostgreSQL scratch data. This checks physical origin and identity, **not package version integrity or lockfile immutability**. A complete frozen-lock installation is still required for the real qualification.

## Independent focused evidence

- Previous source blob: `07d59329826f3e8fed2a708922fb989d5a9bfef0`.
- Earlier B1-193 first fix source blob: `9df907eab145b261c91e51624c7aea9a7be3bb43`.
- Current source blob: `352acc7f6cbd2db1a2750f1737966e0f12c607c0`.
- Existing regression file adjusted for actual resolved files: `14936cdbddc76d7e0ad59ee9a303418a041d6178`.
- New source origin regression file (unchanged from earlier B1-193): `74d38beb158ae6306a83f519cf47a83d767e9e89`.
- New package manifest identity regression file: `a7e88b635fc0fdf70dc25f14a3e08eabbe429ebe`.

**Actual isolated Linux Node22**: exact parent source blob plus persisted 14-case origin suite: **7 PASS / 7 FAIL**; first fixed source **14/14 PASS**. Against the later identity tests, earlier source **1 PASS / 4 FAIL**, updated source **5/5 PASS**. Latest source and both exact GitHub regression files independently matched `git hash-object`; **19/19 PASS, zero skipped** in a combined Node test run. `node --check` of the changed module passed.

The existing `bostan-private-windows-source-workspace-admission.test.mjs` was independently hash-matched and its **six behavior tests passed** in the isolated Linux harness. Its seventh integration test reads `scripts/bostan-private-windows-live-http.mjs`, which was not materialized into the isolated harness; that one failed with **ENOENT in the test harness**, not a product assertion. Therefore, **do not claim the full seven-test suite or the complete workspace passed**. No native Windows execution, compiled HTTP server, native PostgreSQL, Better Auth, Chromium, root TypeScript7 or full Vitest is qualified by these tests.

### Host restrictions and incomplete work

A GitHub tool safety check previously **blocked an attempt to change the five POSIX `fs.symlinkSync(..., "dir")` test fixtures to Windows `"junction"`** in the 14-case origin suite. The blocked change was **not saved**, retried through another tool, or disguised. The existing test suite remains POSIX-symlink-based, so native Windows tests may need special privileges; this PR is intentionally **Draft and not release-ready**.

Remote Desktop Commander also previously returned an explicit **monthly tool quota** message saying the device remained paired but calls were paused. Online/paired status alone does not establish a reset. No quota workarounds or device calls occurred in this work. Previously allocated `D:\Bostan-B212-qa` PostgreSQL-native-asset scratch remains **retained and unverified for copy completion, ownership and cleanup**, with no real PostgreSQL start or crash requested. Do not delete it without later trusted inventory/hash/OS process verification through permitted access.

## Remaining release blockers

The project stays **PRIVATE and NO-GO**. In particular #234 needs actual Windows PostgreSQL forced-crash io_worker zero-orphans evidence and ownership-safe teardown; #237 needs fresh SHA-owned fully installed compiled localhost HTTP with synthetic Better Auth signup, cookies, first-admin roles, tenant isolation and Chromium. Also needed: real Mac/Linux PostgreSQL cache, full TS7/Vitest/root workspace, Linux sandbox, cross-OS packaging, security, consent, privacy and donor LICENSE/NOTICE verification. **No merge to main, publication, Actions, deployment or paid provider use.**
