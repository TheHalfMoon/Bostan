# B1-116 — Reject symlinked ancestor directories in pinned Linux QA paths

Date: 2026-10-31 Asia/Riyadh. PRIVATE, zero-cost, Draft only, no main merge, publication, deployment, release, or Actions enablement.

## Confirmed admission bypass in B1-115 parent

The B1-114 gate checked that the source and test leaf paths were regular files (not leaf symlinks), that their working bytes matched frozen Git blobs, and that `git status --porcelain` was clean. It did not check **ancestor directory components**. An owned synthetic Linux Git checkout was constructed with both paths under a `packages` directory replaced by a symlink to a separate synthetic directory, with byte-identical files. Both leaf tests passed, both Git blob hashes matched, and `git update-index --skip-worktree` concealed the replacement from status. The actual byte-for-byte B1-115 parent gate, Git blob `c685e1b801974fbcee9b2921bef7d380af5eda20`, proceeded past source admission and refused only at the expected Node >=24.11 requirement. This is an **admission integrity gap**, not evidence that Bostan's real Linux sandbox was escaped.

## Minimal repair

After ordinary-file checks, the gate requires `realpath -e` for each pinned file to equal the literal absolute path under the physically resolved QA root. This rejects ancestor symlinks, even when leaf files have correct bytes, before any runtime dependency or namespace/test execution. The original exact source/test blob pins from B1-115 (`6ea8184f05437f0391dc6dad2d923c9795c86be5` and `b40fe2446a9c391b5fec30529e0be2cc9ea86f48`) are unchanged. No new dependencies, privileges, runtime product changes, bypass flags, or cleanup behavior.

The existing self-contained synthetic Git regression was extended by one case: `--skip-worktree` on both paths, move the owned `packages` tree aside, symlink the directory to a separately owned byte-identical tree, verify both leaves are ordinary and Git status is empty, then require a specific early refusal.

## Actual bounded checks

- Native model-side Linux (Git 2.47.3, Node 22.16), no user device or customer data: ancestor-symlink bypass reproduced on the old gate; the new guard rejected with `source resolves through a symlink or outside QA checkout`.
- **Tests-first RED:** extended seven-case regression returned nonzero on the exact original B1-115 gate; the seventh case was incorrectly admitted to the later Node-version check.
- **GREEN:** extended seven-case regression on the patched gate: **7 PASS / 0 FAIL**, including the original six cases. `bash -n` passed for both files.
- The parent gate's exact Git blob was verified locally before patching; the resulting patched gate Git blob is `09bcd3f16bd8c27a9a64c617c2bfc5bee6805630` and the extended regression blob is `8a33e21bff8dc07f464e3a21d27ae0406ab36e7a`. Both match the actual committed GitHub content blobs.
- All model-side temporary synthetic fixtures are owned by this test; no remote Desktop Commander calls, no downloads, no paid services, no changes to Mac/Windows machines.

## Remaining limitations and NO-GO

This is an admission-time path check, not a race-free filesystem capability: another actor with write access to the QA checkout could still race path replacement after preflight. The gate does not cryptographically attest all imported files, local test executables or dependency artifacts. No actual checked-in Bostan Vitest/TypeScript7, real rootless bubblewrap proxy, installed Windows/macOS/Linux app, sustained PostgreSQL stress, agent side-effect consent, or license/NOTICE/provenance qualification was run. Desktop Commander monthly quota remains exhausted and must not be retried.

Next: on a genuinely authorized owner-marked native Linux checkout with admitted resources and preinstalled dependencies, run the committed synthetic regression and the full `--run` source-native gate, preserving exact SHAs/results. Overall Bostan release **NO-GO**.
