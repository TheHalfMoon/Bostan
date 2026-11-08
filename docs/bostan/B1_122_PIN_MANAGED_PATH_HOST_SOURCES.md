# B1-122 — Pin explicitly configured managed sandbox mount sources

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, ZERO COST, DRAFT UNMERGED, RELEASE NO-GO.** Parent B1-121 private Draft PR #377 exact HEAD `7a1d5926157625b79084283d17b02665a8a1d4d8`.

## Verified source identity gap

Earlier B1-119 through B1-121 hardened the physical host SOURCE of workspace, alias, read-only and writable extra mounts. However, `managedPaths` in `buildLocalProcessSandboxSpawnTarget` still used this direct call:

`for (const managedPath of input.options.managedPaths ?? []) await mount(managedPath.path, managedPath.access);`

The `mount` helper then placed the mutable original symlink path into a `bwrap --bind` or `--ro-bind` SOURCE field. A symlink's target could be changed after sandbox target construction but before the child bwrap launcher resolves that argument, allowing the actual host source to differ from the source the operator intended to expose.

On the model's isolated native Debian Linux/Node v22.16.0, a temporary owned managed symlink initially pointed to an approved source, then was retargeted to an unrelated external fixture directory. The original mutable path resolved to the external directory, while `fs.realpath` captured before retargeting remained fixed on the approved directory. **This demonstrates source-argument identity drift, not a demonstrated real-world bubblewrap escape or a full TOCTOU proof.**

## Actual private Bostan changes

**Tests first:** `packages/adapter-utils/src/local-process-sandbox.test.ts` commit `766e79bd6c11db097d6eaa932facab11e300eab1` adds two Linux-gated source-native regression tests:
1. Construct actual Bostan sandbox spawn targets with *both* writable and read-only `managedPaths` pointing through the same authorized symlink. Retarget the symlink after argument construction and verify both `--bind` and `--ro-bind` SOURCE arguments remain the original physical approved path, while sandbox DESTINATION remains unchanged.
2. Preserve the existing behavior that a nonexistent optional managed mount is skipped, while a dangling managed symlink fails closed.

**Production source:** `packages/adapter-utils/src/local-process-sandbox.ts`, commit `83b4513c6744f143e6e387e69152dd325b2f1cef`, normalizes configured managed paths, skips absent optional paths, resolves existing paths to their actual physical source, and passes that canonical SOURCE to the existing mount helper regardless of `rw` or `ro` access. A dangling symlink raises an error instead of becoming an unresolvable or redirected mount. Explicitly authorized managed paths may remain outside the workspace by design. No dependencies, network policy changes, sandbox privilege increases, production data or unrelated files were touched.

## Actual validation and strict limits

The model-side native Linux Node22/Git fixture executed seven bounded assertions using `fs.lstat`, `fs.realpath`, directory symlinks, and only temporary test-owned files: **7/7 PASS**. They covered redirecting a mutable symlink, retaining pinned RW and RO physical sources, skipping a nonexistent managed path, rejecting a dangling managed link, retaining a normal directory, and respecting explicit managed outside-workspace authorization. The fixture and any temporary scripts were removed.

**Do not overclaim:** This independently validates the filesystem-path behavior; the actual checked-in Bostan private-repo Vitest regressions, TypeScript 7 typecheck, and unprivileged `bubblewrap` mount operations **were not executed**. The model container has Node22, no private checkout or bwrap. Desktop Commander previously explicitly reported its monthly quota exhausted and instructed **DO NOT retry/reconnect**, so no DC call was made. Remaining file-system ancestor, mount-namespace and runtime race conditions need separate real tests.

Exact fetched private GitHub blob identities:
- `packages/adapter-utils/src/local-process-sandbox.ts`: `47b75ca07f609f40f295246c086087ffe04538eb`
- `packages/adapter-utils/src/local-process-sandbox.test.ts`: `fdbd8f6395793641222da43acb10ec9912c583be`

The fail-closed Linux four-suite QA script `scripts/bostan-private-linux-sandbox-gate.sh` was repinned to both blobs at commit `4854f6609ab80c21d327460e8354c36cd2ddcaed`, and accompanying B1-112 evidence aligned at commit `0f375dad0592b708a33247b54fda16ee942e6f96`.

## Next mandatory release qualification

In an authorized user-owned disposable private Bostan QA checkout of the exact PR HEAD on native Linux with existing Node >=24.11, Vitest, TypeScript7, rootless bubblewrap and sufficient resources, run `bash scripts/bostan-private-linux-sandbox-gate.test.sh`, followed by `bash scripts/bostan-private-linux-sandbox-gate.sh --run`. Preserve real results and include both new managed-path tests, earlier workspace/alias mounts, proxy and bridge lifecycle. Beyond Linux: qualify installed Windows/macOS/Linux clients, agent effect consent, real PostgreSQL sustained concurrency/crash cleanup (issue #234), privacy/tenant isolation, and all third-party license/NOTICE/provenance obligations. **Full Bostan release NO-GO.** Never make the repo public, merge the Draft PR stack into main, enable GitHub Actions, publish/deploy/release/npm pack, spend on cloud providers, use customer data, or delete others' files/required attributions.
