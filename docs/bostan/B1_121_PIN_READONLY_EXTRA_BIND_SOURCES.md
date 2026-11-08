# B1-121 — Pin read-only extra bind sources against symlink retargeting

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / ZERO COST / DRAFT / UNMERGED / RELEASE NO-GO**.
Direct parent: B1-120 private Draft PR #376, exact head `0cb00466ab1f1988fbdc3f10155b32119ead71dd`.

## Defect and scope

B1-119 and B1-120 pinned physical sources for writable extras, aliases and the workspace root. Explicitly configured read-only `extraPaths` still used the mutable user-supplied path as the host SOURCE for `bwrap --ro-bind`. A writable symlink could be retargeted between spawn-target construction and actual bwrap execution, causing a different host directory to be mounted read-only. This is an authorization-to-mount identity mismatch, not a demonstrated bwrap exploit.

## Fix

In `packages/adapter-utils/src/local-process-sandbox.ts`, the read-only extra mount now resolves its existing host source using `fs.realpath` and passes that physical path to the existing `mount(..., validatedSource)` helper. The in-sandbox destination stays unchanged. Explicit read-only extra paths may still be outside the workspace by design; this change **does not broaden** their authorization. Absent optional paths remain skipped, dangling symlinks fail closed, and no network, privilege, dependency or other agent behavior is changed.

A Linux-gated regression in the actual repository constructs a Bostan spawn target with a read-only symlink to an authorized directory, retargets the symlink after target construction, and checks that the emitted `--ro-bind` SOURCE remains the originally approved physical directory. The test is committed but **NOT EXECUTED** in source-native Bostan Vitest/TypeScript or real bubblewrap.

## Evidence and limits

Independent native model-side Debian Linux Node22 synthetic filesystem check: old mutable read-only SOURCE resolves to a different directory after retargeting (RED); pinned physical SOURCE continues resolving to the originally approved directory (GREEN); ordinary directory behavior remains unchanged (GREEN). All model-side owned scratch removed. This does **not** prove actual rootless bwrap isolation or eliminate parent-directory/OS path lookup TOCTOU races.

Exact source Git blob: `f623fe8a64da75de3f8dbb1632fc1c90e21b88c2`. Exact test Git blob: `f37d1368e6ab7f3b02531f253805b52904bacf84`. The fail-closed B1-112 Linux gate pins both. Run its checked-in synthetic regression and `--run` only on an authorized owner-marked private native Linux checkout with preinstalled Node >=24.11, local Vitest/TS7, unprivileged bwrap and admitted resources. Desktop Commander monthly quota was explicitly exhausted; no retry or remote device access.

Remaining release gates: real source-native Linux tests and bwrap mounts, installed Windows/macOS/Linux qualification, governed agent side-effect consent, sustained PostgreSQL stress (#234), tenant privacy/security, and third-party LICENSE/NOTICE/provenance. No main merge, Actions, publishing, deployment, release, npm pack, paid services, customer data, or unowned cleanup.
