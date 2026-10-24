# B0-23 — Source server prebundle feasibility and cold-import performance

**Status: PRIVATE engineering experiment, not an app launch mode or release artifact.**

Parent: B0-22 private Draft PR #50, main unchanged.

## What was learned

The Bostan source server previously imported thousands of TypeScript files
at first start. The existing esbuild runtime bundler had already supported
bundling server workspace dependencies, but **three development runner vendor
shims imported raw runner TypeScript files dynamically after bundling**.
Therefore the bundled server still required a TSX loader. Plain Node
immediately failed to resolve the source runner's `.js` imports.

B0-23 adds an **opt-in** `compiledRunnerQa` bundler argument, which
rewrites only three exact vendor shim references:

- source runner core index -> previously built runner dist index;
- source runner live index -> previously built runner dist live index;
- source runner testing entry -> previously built runner dist testing entry.

The runner's JavaScript dist entries are checked on disk before the QA
bundle is built. Symlink entries are refused. The default `bundleRuntime`
behavior remains unchanged, and no CLI/install/runtime behavior was altered.
No user HOME, database, agents or remote model are touched.

## Observed experimental measurements — macOS, 2026-10-24

From a disposable git checkout under `/tmp`, with local-only pnpm
install from an existing 4.1 GB pnpm store (zero downloads),
Node v26 on macOS:

| Cold module-import path | Observed wall time |
| --- | ---: |
| Raw server TypeScript source via TSX | 9,176 ms |
| Bundled source with TSX still needed | 7,721 ms |
| Bundled source + compiled runner, **plain Node** | **3,821 ms** |

The final proof dynamically imported `server.mjs` and verified
`typeof startServer === "function"` without starting the app.
Bundling 2,089 inputs into 116 JS chunks took approximately 4.8 seconds
in the local Mac experiment; the output was roughly 65 MB.

To reproduce inside a disposable, dependency-prepared checkout, first build
workspace plugin SDK and runner TypeScript (including its eval-kernel
dependency), then invoke the repository-local bundler:

`bundleRuntime({entry: path.resolve("server/src/index.ts"),
outdir: path.resolve("server/dist-runtime-qa"), compiledRunnerQa: true})`

Load `server/dist-runtime-qa/server.mjs` with Node's normal ESM import
and verify its `startServer` export. **Never commit or publish the
generated dist-runtime-qa files**; this is not a portable installer.

## Explicit limits

These are **one cold module-import measurement per configuration**,
not benchmark medians, not process start to HTTP 200, and not Windows native
performance. The normal source-runtime parent/child process path is unchanged.
The generated JS still resolves external packages and assets from the
source checkout and embeds development source locations; it is NOT a
self-contained consumer desktop runtime and not safe to move off the
original disposable checkout. The experiment does not replace the source
build's legal attribution or licensing metadata.

Before it can become a supported startup option:
native Windows repeatable cold-load and full HTTP/DB/agent E2E, integrity
and freshness receipts tied to exact source and external deps, asset staging,
correct cross-platform path resolution, clean stop/crash recovery, rollback,
and packaged Node/PostgreSQL dependency validation are required.

Release **NO-GO**. No publishing, main merge, deployment or Actions enabled.
