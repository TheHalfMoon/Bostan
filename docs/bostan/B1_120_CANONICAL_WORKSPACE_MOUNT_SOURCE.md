# B1-120 — Pin the main workspace mount to its admitted physical root

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, ZERO COST, DRAFT, UNMERGED — NO RELEASE/DEPLOY/PUBLISH**. Stacked on private Draft B1-119 PR #375 exact head `d33ae85cb43e3db8245b03dc30c0ad3ca4d84dad`.

## Confirmed policy/command gap

The B1-119 Linux filesystem sandbox correctly pinned physical host sources for path aliases and writable extraPaths. However, it still issued `await mount(workspaceDir, "rw")` with the original `workspaceDir` spelling as the host source. A user-configured workspace path can itself be a symlink, so after the policy authorizes `fs.realpath(workspaceDir)`, a writable parent can redirect that link before the `bwrap` child is spawned. The actual argv host SOURCE then points somewhere **other than the physical workspace approved by policy**.

Model-side native Linux Node22 verification using a new, self-owned, isolated synthetic directory:
1. Create `approved/`, `external/`, and `workspace -> approved/`.
2. Record the admission result `realpath(workspace) == approved`.
3. Retarget `workspace -> external/` before the future launcher reads bwrap argv.
4. Old argument SOURCE `workspace` now resolves to `external/`; approved canonical SOURCE `approved/` remains inside.

Result **PASS (RED old source / stable new source)**. All ephemeral synthetic dirs removed. This validates a command-construction risk; it is **not proof of an installed system or bubblewrap mount escape** and does not eliminate all residual ancestor-directory/TOCTOU races.

## Code and regression in actual private GitHub repository

Test-first commit `daf5d5e727f9981b49deb098725bb2bfbf4444cd` modifies `packages/adapter-utils/src/local-process-sandbox.test.ts`: one Linux-gated source-native test creates `workspace` as a link to an authorized physical directory, builds the actual Bostan `buildLocalProcessSandboxSpawnTarget`, then retargets the link to an outside directory. It checks that the stored workspace `--bind SOURCE DESTINATION` retains the original approved real path, while DESTINATION stays the user-requested workspace path.

Source commit `7c6f711a904e3d8e37f30f5d93d4ccdaec49dda3` changes only the main workspace mount invocation to `await mount(workspaceDir, "rw", physicalWorkspace ?? undefined)` using the physical workspace already authorized by B1-118. This preserves the requested in-sandbox destination and normal non-symlink workspace semantics, while avoiding mutable workspace root symlink as the host mount source. Existing source pinning for writable extraPaths and aliases, allowlisted network, agent permissions, privacy and dependencies remain unchanged.

## Exact candidate identity and qualification

Final code Git blob `2347ccb0b17011559bffdd733bbcf73d8e0b45b0`; checked-in Linux regression test blob `5b4edd3b374a1a96fe6572be1a666bda2b227191`. Both pins were updated in `scripts/bostan-private-linux-sandbox-gate.sh` commit `a15100042c006363e0bf4ef9cec0486946b2bb67`, and the historical QA description `docs/bostan/B1_112_LINUX_SANDBOX_SOURCE_NATIVE_GATE.md` updated in `78456cc7e758b5822775f8ac8372da40f4f7bf3a`. Check exact equality with GitHub blobs before admitting source-native tests.

**Actually executed:** one bounded native model-side Linux Node22 synthetic filesystem symlink-retargeting reproduction as described above; old source remapped to unauthorized external directory, frozen source remained physical original. Owned temporary model-side files cleaned.

**Not executed:** checked-in Bostan Vitest regression, real `packages/adapter-utils` TypeScript7 noEmit, rootless `bwrap`, actual mounted-filesystem runtime behavior, full private repo package suite, installed Windows/macOS/Linux app, agent side-effect consent, real PostgreSQL prolonged concurrency (issue #234) or license/NOTICE/provenance qualification. No paid service or user-computer changes; Remote Desktop Commander previously reported its monthly quota exhausted and explicitly prohibited further retries, so no DC access was attempted.

## Next release gate

On an authorized separate private Linux QA checkout, preinstalled dependencies and unprivileged bwrap, execute `bash scripts/bostan-private-linux-sandbox-gate.test.sh` and `bash scripts/bostan-private-linux-sandbox-gate.sh --run`, then inspect mounting, root symlinks, path races and lifecycle together under actual Linux isolation. No privilege bypass, service installation or user file cleanup. Windows/macOS/Linux installed qualification, security/privacy, consent/agent effects, real PostgreSQL stress and legally required donor license notices remain blocking. **Overall Bostan RELEASE NO-GO; keep repository private, PR DRAFT unmerged, main unchanged, Actions disabled, no publishing/deployment or paid compute.**
