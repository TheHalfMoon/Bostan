# B1-114 — Pin executed worktree bytes, not only HEAD and Git status

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, DRAFT, zero-cost, no production publish/deploy/release or main merge.** Stacked on private Draft B1-113 #369 exact head `762c6379a316b489dee9da46b866d010f8811c9e`.

## Reproduced integrity bug in source-native qualification gate

Existing `scripts/bostan-private-linux-sandbox-gate.sh` compared the Git `HEAD` blobs for `packages/adapter-utils/src/local-process-sandbox.ts` and `.test.ts` to frozen B1-113 SHA pins, then used `git status --porcelain` to reject uncommitted changes. Git's `--assume-unchanged` and `--skip-worktree` index bits can conceal local modifications from `git status`, even while the on-disk file that Vitest or TypeScript will load is changed. That could have resulted in `BOSTAN_B112_LINUX_GATE_PASS` being attributed to a pinned code/test identity that was **not** the content actually executed.

Actual native Linux Git v2.47.3 reproduction in a disposable, owner-created synthetic repo: with `git update-index --assume-unchanged safe.ts`, modify `safe.ts`; `git status --porcelain -- safe.ts` remained **empty**, `git rev-parse HEAD:safe.ts` remained the original pinned blob, but `git hash-object safe.ts` correctly differed. This shows the original admission preflight was insufficient.

## Repair

**B1-114 production gate patch `103b6d2aeb7763aaa9e7975783ee1f24e7d6e449`** adds, after existing pinned `HEAD` and status checks but before any dependency/namespace/test execution:

- Both source and test must be **ordinary checkout files**, not symbolic links.
- `git hash-object -- "$root/$source_path"` must equal the pinned production source blob `200da80d364053aa984d83d66864b02e99258f79`.
- `git hash-object -- "$root/$test_path"` must equal the pinned corrected test blob `fa96f8055107500cdc8b608740ac08a523637b3b`.
- Fail-closed nonzero error on either mismatch, **even if Git status is empty**. Existing Linux, ownership, remote, no-install, resource and `bwrap` gates remain unchanged. No bypass, override or privilege escalation flag was introduced.

**Committed regression executable:** `scripts/bostan-private-linux-sandbox-gate.test.sh`; first committed at `41d595add11674dbb55770109ec0769e9493ac9a`, corrected shell TMPDIR expansion `121402a5cbe36556d3f4551a49bdf8b1e48bd7eb`; final actual Git blob **`75c50c51078741c75437c3d9c92b55bc2de27d8d`**. This is a self-contained test that creates only its own throwaway Git repository; its source/test files are **synthetic**, and its *local copy* of the QA gate is repinned to those synthetic blobs to exercise admission logic without private project contents or dependency installation. The real GitHub script and production source pins are never rewritten by the test. It checks a valid pinned fixture proceeds past hash admission to a later nonzero requirement (Node version or local missing Vitest), and exact expected fail-closed outcomes for four hidden-file changes: `assume-unchanged` + source/test and `skip-worktree` + source/test; and replacement by an external symlink with byte-identical content. Cleans only its own temporary fixture on process exit.

## Actual QA and hard limits

Model-side **native Debian 13 Linux / Git 2.47.3 / Node v22.16.0**, no user machine, no paid provider, no external network:
- Actual Git hidden mutation RED: clean Git status but different HEAD and worktree content hashes — reproduced.
- `bash -n` passed on the locally reconstructed updated gate and the exact regression script.
- `bash scripts/bostan-private-linux-sandbox-gate.test.sh` against the local reconstructed gate: **6 PASS** (1 positive admission + 4 hidden-mutation rejects + 1 symlink reject), **0 FAIL**. Synthetic fixture created under its own isolated /tmp and removed.
- Postcommit fetched GitHub version of regression script has exact **Git blob `75c50c51078741c75437c3d9c92b55bc2de27d8d`**, identical to the locally executed regression-script blob. Source gate at GitHub HEAD inspected and verified both worktree hash checks, ordinary file checks, and old frozen pins. **The locally reconstructed gate test copy is not itself byte-for-byte verified against GitHub source**, so do not claim the checked-in gate was executed in its live GitHub checkout.
- **Not run**: actual Bostan source-native Vitest suites, adapter-utils TypeScript 7 typecheck, genuine bwrap/Linux proxy, Mac/Windows installed app, real PG stress, consent, license/NOTICE/provenance and overall release qualification. Remote Desktop Commander previously instructed not to retry due exhausted monthly quota; no remote device calls were used.

## Next qualification

In a separately owned PRIVATE, native Linux QA checkout with preinstalled Node>=24.11, local dependencies and unprivileged bwrap: run the committed synthetic admission regression script `bash scripts/bostan-private-linux-sandbox-gate.test.sh`, then run the pinned actual source gate `bash scripts/bostan-private-linux-sandbox-gate.sh --run`. Preserve exact SHA and full failure logs. Never override sandbox kernel restrictions, create ephemeral markers on someone else's repo, use customer data or paid cloud. Full cross-platform product release remains **NO-GO**, Draft private unmerged.
