# B1-126 — Pin every selected native Vitest suite against hidden worktree changes

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / DRAFT / UNMERGED / ZERO COST / RELEASE NO-GO.** Direct parent: B1-125 private Draft #381 at `7806368d84f2915bda225105d0ad26081a2ae7e7`.

## Confirmed qualification integrity gap

The B1-125 Linux gate pinned the production sandbox source, its `local-process-sandbox.test.ts`, and the JSON auditor plus its regression file. However, it also executed three other selected Vitest suites without pinning their HEAD or on-disk bytes:

- `execution-target-sandbox.test.ts`
- `paperclip-runner-permissions.test.ts`
- `sandbox-install-command.test.ts`

In an isolated real Git 2.47.3 Linux fixture, setting `--skip-worktree` on an additional suite and modifying its on-disk contents produced **empty `git status --porcelain`** while `git hash-object` differed from `HEAD:<path>`. Thus the old admission checks did not bind all executed test files to reviewed bytes. This is a **qualification false-green risk**, not evidence of a production sandbox escape.

## Repair in this Draft branch

The existing `scripts/bostan-private-linux-sandbox-gate.sh` now pins all three additional suites to the exact private parent Git blobs:

| File | Git blob SHA |
| --- | --- |
| `execution-target-sandbox.test.ts` | `377be29a853dc9189a280c62cc8177248281d220` |
| `paperclip-runner-permissions.test.ts` | `fcaeea10fca499b98543a218f502809fde44fb48` |
| `sandbox-install-command.test.ts` | `882634137621026b645e8f77d6e4355a571717ba` |

For each file, the gate verifies the reviewed HEAD blob, ordinary non-symlink leaf, physical canonical path inside the QA checkout, clean Git status, and independently computed on-disk Git blob. All checks run **before** the Node/dependency/bwrap admissions and before any source-native tests. The existing source/test/auditor pins and exact four-rootless-case JSON audit remain intact.

The checked-in `scripts/bostan-private-linux-sandbox-gate.test.sh` now creates three synthetic extra suite files, repins **only its disposable gate copy**, and tests hidden tampering under both `--assume-unchanged` and `--skip-worktree` for each of the three suites (six new expected refusals). It retains the earlier nine synthetic cases, so a complete future execution should show **15 synthetic admission cases**. No runtime dependency, production code, or license/NOTICE was changed.

## Objective execution and limits

**RED, actually reproduced:** model-side native Linux Git 2.47.3 synthetic repository, one unpinned extra suite marked `--skip-worktree`, modified disk bytes, `git status` empty and HEAD/disk hashes unequal.

**GREEN, actually executed:** an isolated owner-created Linux Git fixture running the new gate's five-check logic against three synthetic additional suite files. A clean baseline was admitted, and six hidden-tamper variants (three files × two Git index flags) were each rejected with the intended `additional suite working-tree bytes differ from pinned source` message. Extracted Bash check passed `bash -n`. Result: **6/6 PASS** for the extracted guard and synthetic Git fixture, with owner-created scratch removed.

**Not executed:** the entire exact checked-in B1-126 Bash regression script, actual private Bostan four-suite Vitest, adapter-utils TypeScript7, real unprivileged bubblewrap integration, installed Windows/macOS/Linux products, or sustained PostgreSQL load. This Linux model container has Node 22, no full private checkout, no installed bwrap/Vitest/TypeScript; the authorized Desktop Commander quota previously instructed DO NOT RETRY. The six isolated checks must not be reported as source-native qualification.

## Next mandatory gate

On an authorized, disposable, owner-marked **private** checkout pinned to this Draft PR HEAD, with preinstalled Node >=24.11, local Vitest5/TypeScript7, rootless bwrap and sufficient RAM/disk:

```sh
node --test scripts/bostan-private-linux-vitest-report-audit.test.mjs
bash -n scripts/bostan-private-linux-sandbox-gate.sh
bash -n scripts/bostan-private-linux-sandbox-gate.test.sh
bash scripts/bostan-private-linux-sandbox-gate.test.sh
bash scripts/bostan-private-linux-sandbox-gate.sh --run
```

Require 11/11 auditor tests, 15/15 synthetic gate cases, four genuine native bubblewrap tests present and passed in audited Vitest JSON, four full source-native suites green, and adapter-utils TypeScript7 green. Fail closed on any skipped, missing or failed required rootless case. Preserve exact logs and exit codes.

**Release remains NO-GO.** Cross-platform installed qualification, governed agent side effects and consent, privacy/security, real repeated PostgreSQL stress issue #234, and upstream LICENSE/NOTICE/provenance remain open. No main merge, publication, deployment, release, npm pack, Actions enablement, paid service, customer data, or unowned cleanup.
