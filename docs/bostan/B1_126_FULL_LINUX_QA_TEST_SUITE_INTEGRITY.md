# B1-126 — Verify all four Linux sandbox test-suite files before qualification

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / ZERO COST / DRAFT / UNMERGED / NO RELEASE.** Direct parent: B1-125 private Draft PR #381 exact HEAD `7806368d84f2915bda225105d0ad26081a2ae7e7`.

## Confirmed incomplete QA integrity protection

The Linux source-native qualification gate `scripts/bostan-private-linux-sandbox-gate.sh --run` executes exactly four Vitest files. Before B1-126, its fail-closed Git HEAD and worktree blob verification protected only `packages/adapter-utils/src/local-process-sandbox.test.ts` (plus its paired production source and new JSON auditor). The other **three executed test-suite files were not checked for Git identity, local tampering or symlink replacement**.

A local checkout can use Git `--assume-unchanged` or `--skip-worktree` to hide modifications from `git status`. This matters because the JSON report auditor verifies that required suite filenames exist and pass, but does not establish that those suites are the genuine, committed source. A replaced suite may pass trivial tests. The risk is qualification evidence integrity, **not** a demonstrated sandbox escape or exploit of a production agent.

The additional exact GitHub HEAD file blobs at this parent commit, independently retrieved via the connected private GitHub source, are:

| Executed source-native Vitest test file | Pinned HEAD Git blob |
| --- | --- |
| `packages/adapter-utils/src/execution-target-sandbox.test.ts` | `377be29a853dc9189a280c62cc8177248281d220` |
| `packages/adapter-utils/src/paperclip-runner-permissions.test.ts` | `fcaeea10fca499b98543a218f502809fde44fb48` |
| `packages/adapter-utils/src/sandbox-install-command.test.ts` | `882634137621026b645e8f77d6e4355a571717ba` |

The already-protected `local-process-sandbox.test.ts` remains pinned to `d0d4b391fad3f5f10379c71e091f367b25299eb1`.

## Actual private GitHub change

- Gate production qualification script commit `fc98aa5032e955d1cfb35a71856d65123022edd8`: insert a frozen `suite_specs` list for the three previously unprotected files. For each require (a) `HEAD:path` matches the exact expected blob, (b) no normal uncommitted modifications, (c) regular nonsymlink leaf, (d) canonical path matches within the checkout (no symlink ancestor), and (e) **actual working-tree bytes** `git hash-object` match the pinned HEAD blob even when Git status flags conceal changes. All mismatches fail closed **before** running the expensive rootless namespace probe or Vitest.
- Synthetic gate regression script commit `d521b35056bbc8ef4f16cbe7f0f27c90578cb4f9`: extend only the owned throwaway Git fixture with 3 synthetic suite files; replace the three corresponding pins **only inside the fixture copy**. Assert 6 rejected hidden modifications (3 suites × `assume-unchanged` and `skip-worktree`) plus one rejected byte-identical symlink replacement. Preserve prior 9 admission-integrity cases, for an expected 16-case test.
- No production Bostan source, actual Vitest suites, network allowlists, sandbox permissions, packages, or user data were changed. The upstream donor named `paperclip-runner-permissions.test.ts` was **not renamed**, as a path rebrand now would require coordinated source renames and qualification; this branch strictly concerns trust in the files presently executed.

## Actual tests performed and caveats

**Actual model-side Linux / Git version verification** used only an owner-generated disposable synthetic Git repository, deleted after the run. The **same five admission predicates as added to the gate** were exercised against three fixture suite filenames and temporary Git commits using real `git update-index`, `git status`, `git hash-object`, `realpath`, symlinks and Bash. **9/9 isolated test cases passed**: one clean accept, six hidden modifications denied, one symlink substitution denied, one visible modified suite denied. All temporary test paths removed.

**Important scope limit:** These 9 isolated assertions are not a claim that the entire newly edited checked-in 16-case `scripts/bostan-private-linux-sandbox-gate.test.sh` was executed. Its new expected 16 cases are **authored and committed but not source-native executed** in this wave. The previous 9-case original fixture had been executed and passed in B1-125, and the 11-case JSON audit test had passed there as well. No new actual full Bostan Vitest5, TypeScript7, unprivileged bubblewrap or installed app runtime qualification was executed here. Model container runs Node22 and lacks the full private Bostan checkout and bubblewrap; Desktop Commander previously explicitly reported monthly quota exhaustion and instructed not to retry.

Re-fetched final code identity from private GitHub:
- `scripts/bostan-private-linux-sandbox-gate.sh` Git blob: `d1995c96061ab45ced10bd3d30b427fc27b2c4df`
- `scripts/bostan-private-linux-sandbox-gate.test.sh` Git blob: `88aa47b1656b9e3dae8667afba3e9484d1f6806a`

## Next actual release gates

On an **authorized disposable owner-marked private Linux checkout** at exact new B1-126 PR head, with locally installed Node >=24.11, TS7, Vitest and genuine rootless bubblewrap, execute:
1. `node --test scripts/bostan-private-linux-vitest-report-audit.test.mjs` (11 real audit cases).
2. `bash scripts/bostan-private-linux-sandbox-gate.test.sh` (16 synthetic HEAD/worktree/symlink refusal cases).
3. `bash scripts/bostan-private-linux-sandbox-gate.sh --run` (four real Vitest suites, four mandatory actual rootless bubblewrap integration cases, exact report attestation, package TypeScript check).

Store actual test logs and preserve failures; never bypass kernel sandbox restrictions or soften integrity pins. Outside this Linux gate, installed Windows/macOS/Linux apps, controlled agent side effects and consent, repeated real PostgreSQL load/crash stress (issue #234), privacy/tenant isolation and legally required third-party licenses/NOTICE/provenance remain unqualified.

**Bostan full product release: NO-GO.** Keep GitHub PRIVATE, all PRs DRAFT UNMERGED, main unchanged, Actions disabled, no paid providers, customer data, publishing/deployment/release/npm pack, or unowned file deletion.
