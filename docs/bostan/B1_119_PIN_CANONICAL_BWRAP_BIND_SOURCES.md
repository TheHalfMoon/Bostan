# B1-119 — Pin validated physical sources for Linux sandbox bind mounts

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, zero-cost, DRAFT / UNMERGED, no release/publish/deploy**. Exact parent B1-118 private Draft PR #374 HEAD `e61e53bb5958c91be8bb0c6f5f50289cec1e59cc`.

## Verified source/path integrity gap

B1-118 validates that workspace path aliases and writable extra paths resolve within the physical workspace (or an authorized outbound restore root) using `fs.realpath`. However, after validating the physical target, the `bwrap --bind SOURCE DESTINATION` arguments still used the original **mutable symlink spelling** as SOURCE. Between building the sandbox target and subsequently launching the bubblewrap process, a workspace-writable link could be replaced with one pointing outside the workspace. The launcher would then resolve a different source than the path the policy had admitted.

This is an actual argument-selection/TOCTOU weakness visible in the code. **It is not evidence that a production bubblewrap escape occurred.** Residual parent-directory changes and races cannot be excluded without real namespace testing and deeper OS-level handle-based design.

On native model-side Linux Node22 in an isolated, owner-created synthetic directory: initially `workspace/link -> workspace/inside`; after the policy resolution, change `workspace/link -> outside`. Original `--bind workspace/link /app` resolves to the outside source. `--bind workspace/inside /app` continues to resolve to the authorized directory. Same result for a writable `extraPath` source. No external requests, user secrets, or other user-machine files were involved.

## Actual production code change

GitHub production source commit **`369fcc45956cf97174d8a44806cbe638ba57bd9e`**, in `packages/adapter-utils/src/local-process-sandbox.ts`:
- Save the **realpath approved during filesystem policy admission** for each existing, writable `extraPaths` source in `validatedWritableExtraSources` (the same exact source that passed the existing physical workspace or outbound restore policy).
- Extend the internal `mount(source, access, validatedSource?)` helper to emit the frozen physical source as the first `--bind` argument while preserving the requested destination path. No change to ordinary system readonly bind mounting.
- A writable optional extra path that **did not exist when policy admission ran is not mounted later** if it happens to appear after admission. No unvalidated late-created path can be promoted silently.
- For `pathAliases`, pass the already authorized `physicalAliasTarget` to `--bind`, rather than the mutable `aliasTarget` symlink. Preserve the requested alias destination.
- Normal nonsymlink paths produce the same bind arguments as before. Explicitly authorized restore paths remain eligible. No change to network policy, package dependencies, GitHub Actions, host privileges or user data.

## Added source-native regression and independent bounded checks

Source-native test changes at commit **`892427837ea9be0b143a4abd3b4709940fab5429`**:
- Update existing positive Linux alias-symlink regression to expect the actual canonical source for both the alias bind and writable extra bind.
- New Linux-gated regression constructs both an alias and RW extra using an internal symlink, builds the real Bostan sandbox spawn target, retargets the symlink to an outside directory **after** spawn target creation, and asserts BOTH stored `--bind` SOURCE arguments remain the original authorized physical inside directory.
- This regression is committed but **NOT RUN in the actual Bostan private-repo Vitest suite**.

Native independent model-side Linux Node22 filesystem/argv simulation (not full TS module) **6/6 PASS**: old extra and alias source strings both resolve outside after retarget, both pinned sources remain inside, ordinary path unchanged, and an optionally missing path appearing only after admission remains unapproved. All synthetic temp directories removed.

Final GitHub source blob `07daf764547d019d9349d5d114f272e828a75cfd` and test blob `79ad360a114844ebd230ccb1ae1906f42aa112c5` were independently retrieved and repinned exactly in `scripts/bostan-private-linux-sandbox-gate.sh` at commit **`ad59e5f8d4c1d7d79fcd53ff89dc61058bfebe19`**. Companion B1-112 gate evidence updated at commit **`58bbf9b7f288abb9d512039b694b038fcfc9351d`**.

## Hard release limits

Actual full Bostan source-native Linux Vitest and TypeScript7, sandbox `bubblewrap` mount/namespace behavior (including symlink races), installed Windows/macOS/Linux clients, agent execution consent and side effects, repeated real Windows PostgreSQL concurrency and issue #234, tenant privacy/security, and required third-party licenses/NOTICE/provenance are still **NOT QUALIFIED**. The model-side runtime lacks the actual private Bostan checkout, Node24+, and `bubblewrap`; Desktop Commander previously reported monthly quota exhausted and instructed not to retry, so no remote device call was made. Maintain full **NO-GO** release; repository PRIVATE, Draft PR unmerged, main unchanged, Actions disabled, no paid services, customer data or unowned cleanup.
