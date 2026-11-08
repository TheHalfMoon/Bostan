# B1-118 — Canonical filesystem containment before Linux sandbox bind mounts

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, zero-cost, Draft and unmerged, no publishing/deploying/releasing.** Parent B1-117 private Draft PR #373 exact head `1730167da22bcdad3a7a3a88b81a0c4ffbcfe600`.

## Actual admission weakness

In `packages/adapter-utils/src/local-process-sandbox.ts`, `buildLocalProcessSandboxSpawnTarget` validates workspace `cwd`, writable `extraPaths` and `pathAliases[*].target` using only `path.relative(workspaceDir, candidate)`. Lexical containment is insufficient when a requested path is a symbolic link located inside the workspace but resolves to a location **outside** its physical root. Both writable extra mounts and alias mounts are later represented as `--bind` arguments to Linux bubblewrap, so authorization must check the source's actual resolved location, not only its spelling. This is a proven **policy admission weakness**; real bwrap mounted escape on a production host has **not** been demonstrated in this wave.

**Model-side Debian Linux/Node22 reproduction** using self-owned temporary directories:
- `workspace/escape` symlinked to `outside`; lexical `path.relative(workspace, workspace/escape)` reports an inside path, yet `fs.realpath(workspace/escape)` resolves outside.
- Same mismatch applies to an alias target, writable extra path, or workspace cwd.
- Internal symlinks and an explicitly authorized physical outbound restore directory should remain eligible.
No outside customer data were read or touched; the model-side fixture contained synthetic files only.

## Actual source repair

Test-first GitHub commit `c9fa8a5003f08ff9cae19ff52a51a5ee81a49d4a`: four Linux-only regressions for writable extra symlink escaping workspace, path alias symlink escaping workspace, cwd symlink escaping workspace (all must refuse) and a valid alias+RW path resolving **within** workspace (must remain permitted).

Source fix GitHub commit `dc1b96fcfce482e16c5b74e354eae0a146eb0a75`:
- New `isPathWithinRoot(root,candidate)` checks path containment with exact `..` component semantics.
- Resolve the workspace directory and cwd using `fs.realpath` before granting filesystem sandbox paths, so a lexical inside path whose actual destination is outside is rejected.
- For writable `extraPaths`, continue the existing lexical workspace/explicit outbound restore policy **and** check each existing path's resolved destination against the canonical workspace or resolved explicitly authorized restore directories; unavailable optional paths are still skipped by the existing mount helper; dangling symlinks fail on `realpath`.
- For path aliases, insist the target exists and its actual resolved directory lies within the canonical workspace before issuing `--bind`. An alias pointing to an internal symlink remains valid.
- Preserve previous system readonly paths, all network rules, trust checks, genuine Linux namespace invocation and no-cost/offline-first behavior. No new packages, external network, secret access or GitHub Actions changes.

Additional regression commit `64c9ca1d36ffde67b27797785c7885b441622de6`: two more Linux tests prove a separately authorized writable outbound restore path remains permitted and a dangling alias symlink fails closed. **Six new source-native Linux Vitest test cases were committed but not executed in this wave.**

## What actually ran (bounded)

Independent native Linux Node22 short-lived JavaScript fixture exercises the same lexical vs realpath boundary for seven cases; **7/7 PASS**:
1. Alias outside: old lexical allowed, resolved physical denied
2. Writable extra outside: old lexical allowed, physical denied
3. Cwd outside: old lexical allowed, physical denied
4. Internal alias: both allowed
5. Normal internal directory: both allowed
6. Explicit physical restore-mapped outside path: accepted under authorized restore root
7. Dangling symlink: `fs.realpath` throws, fail-closed

Model-side directories and scripts were removed after test, with no user-machine changes. This verifies the policy logic but **does NOT execute the private Bostan TypeScript module, source-native Vitest, package TypeScript7 or bubblewrap**. True Linux mount semantics and filesystem race/TOCTOU behavior remain unqualified; avoid claiming a complete isolation security proof.

Actual private GitHub file blobs at source commit:
- `packages/adapter-utils/src/local-process-sandbox.ts`: `ea5ba46d454e41cb36f3a76c478b745474c3d2f4`
- `packages/adapter-utils/src/local-process-sandbox.test.ts`: `66dc3722729676784fdb9d49d68b4b9df29baad3`

These are the exact current `scripts/bostan-private-linux-sandbox-gate.sh` source/test pins after commit `1f8bf4e394c946a0f4a7df6e00072067ffe288b9` and companion qualification document update `49508198464255506b0823b535596d8e3bdae2fb`.

## Remaining release qualifications

Run actual B1-118 native Linux owner-marked disposable private QA checkout with installed dependencies and unprivileged `bwrap`: the source-native four-suite Vitest, the full adapter-utils TypeScript7, alias/RW symlink bind and actual runtime containment checks, plus bridge/HTTP socket cancellation regressions. Preserve genuine errors. Also qualify signed/installed Windows/macOS/Linux product, consent and agent side effects, repeated PostgreSQL load/crash/tenant safety, security/privacy and legally required third-party licenses/NOTICE/provenance. Desktop Commander tool previously reported its monthly quota exhausted and explicitly refused retries; no DC calls this wave. **Release NO-GO**; keep repo PRIVATE, all PRs DRAFT and unmerged, main unchanged, GitHub Actions off, no publishing/deploying, paid services, customer data or unowned cleanup.
