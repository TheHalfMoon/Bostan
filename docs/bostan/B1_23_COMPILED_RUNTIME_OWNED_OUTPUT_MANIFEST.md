# B1-23 — Fail closed before deleting an unowned compiled runtime

Date: 2026-10-29. Repository `TheHalfMoon/Bostan`; PRIVATE, strictly nonpublishing. Parent B1-22 Draft PR #275 exact head `d82567e9ba8ec157f6193f15516dab6f68fa570a`. No main merge, release, deploy, npm packaging, paid models, real customer data or GitHub Actions.

## Confirmed production boundary defect (red before fix)

B1-22 correctly admitted only dedicated, local, unlinked `runtime`/`dist-runtime` output paths, but `assertSafeRuntimeOutdir(entry, outdir)` returned success for any existing **nonempty** directory under that name. `bundleRuntime` then called `rm(admittedOutdir, {recursive:true,force:true})`, which would delete anything in the directory without proving Bostan owned those files.

An independent native Windows 11 / Node 24.19 test created a disposable isolated source tree, put a synthetic `IMPORTANT_USER_DATA.txt` in `server/dist-runtime`, and asserted admission must fail. Original B1-22 source **failed the test** as `Missing expected rejection` (RED). The test did not invoke the recursive deletion and did not affect operator data.

## Narrow fail-closed repair

`server/scripts/bundle-runtime-output-admission.mjs` now rejects all nonempty existing output directories except a fully previously verified Bostan compiled output. Successful esbuild output gets a local `.bostan-compiled-runtime-owner.json` marker, written exclusively (`wx`) **after** esbuild's successful bundle. The marker binds to the exact entry path and outdir and records the exact generated file set and per-file SHA-256 digests.

Before the next recursive deletion, admission checks the directory and marker are not links/junctions; the schema, entry and outdir must match; all files must be recognized generated flat `.mjs`/`.mjs.map`/`.css` outputs; the directory must contain **no foreign, missing, added, edited, or linked files**; each SHA-256 must match. Hashes are streamed to avoid loading full bundles into memory. Unowned directories, invalid/missing markers and modified files are not deleted. New empty output directories continue working; a second rebuild of an unchanged Bostan output remains possible. Bundler uses the admitted canonical output path and records generated files only after success.

Conservative compatibility effect: a pre-existing nonempty runtime built before this marker exists cannot be blindly deleted. The user must explicitly relocate or inspect it; this is intentional, not a migration that deletes old contents.

## Executed tests

- Real Windows 11 Node v24.19.0 on an agent-owned isolated `D:\\Bostan-B123-qa` Git worktree. Node syntax checks and `git diff --check` passed.
- Original native regression **RED 0/1** when nonempty unowned `dist-runtime` was admitted; the synthetic sentinel stayed intact.
- After patch: `node --test server/scripts/bundle-runtime-output-admission.test.mjs` **6/6 PASS**.
- Real locally cached **esbuild 0.28.2** integrated into the isolated B123 worktree using a temporary *verified* Windows junction to preexisting pinned B111 pnpm content. Tested together with actual `bundleRuntime` and the existing source-compiled workspace/third-party externalization fixtures: **8/8 PASS**, 0 FAIL, 0 SKIP. Proved the real bundle runs from built JS after removing the source package, third-party package remains runtime-external, a second marker-owned build succeeds, and a foreign user file inserted afterward blocks rebuilding without deletion.
- The exact temporary B123 junction was identity-checked and unlinked using `cmd.exe /c rmdir` (not recursive removal); existing B111 dependency contents were not modified. No PostgreSQL or heavy model/server run because free system RAM was approximately 1.1–1.9 GiB, below native integration admission.

## Limits / NO-GO

This is an accidental-data-loss prevention boundary, not protection against a privileged malicious process that races and mutates the filesystem between admission and actual deletion (TOCTOU). This selective test does **not** establish an end-to-end compiled Bostan source server, authenticated Windows 18-stage HTTP, Playwright/Chromium, macOS qualification, real first free local agent or installer correctness. Windows real source HTTP issue #237 and PostgreSQL orphan multi-suite issue #234 remain OPEN. Keep repo PRIVATE, Actions OFF, stacked Draft only, no main merge/deployment/release/publication. Product release NO-GO.
