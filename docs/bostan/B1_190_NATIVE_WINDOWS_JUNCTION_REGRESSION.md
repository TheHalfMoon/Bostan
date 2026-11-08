# B1-190 — Actual native Windows junction coverage for workspace link preflight

Date: 2026-11-02 Asia/Riyadh. **Private Draft, stacked, unmerged, release NO-GO.**

## Purpose

B1-188 (private Draft #445) replaced a destructive workspace relinker with fail-closed checks. Its native Windows Node24 synthetic filesystem test reported **11 passed and 4 skipped** because the tests tried to create ordinary directory symlinks with `fs.symlinkSync(target, destination, "dir")` but the unprivileged Windows host refused with `EPERM`. The actual product's repaired relinker uses **Windows junctions** (`fs.symlink(..., "junction")`) and does not require those symlink privileges for normal scoped workspace dependency links. Thus the four skipped security cases were not representative of the actual Windows link type.

## Focused test improvement

Four existing synthetic tests now use `process.platform === "win32" ? "junction" : "dir"`, without modifying source behavior or removing the bounded `EPERM` skip guard for a host that genuinely cannot create junctions. This exercises:

- Wrong/foreign link: refuses without rewriting link or altering an external `KEEP` file.
- Dangling junction: refuses a link whose target does not exist, rather than treating it as an absent destination.
- Linked scoped `node_modules/@bostan` directory: refuses before writing through it.
- Linked `node_modules` parent: refuses before writing through it.

A separate owner-only Windows probe first confirmed junction creation and removal of *its own* link worked without elevated privileges. Test file is otherwise unchanged on POSIX (still creates ordinary `dir` symlinks).

## Real native Windows evidence

- Host: Windows 11, Node `v24.19.0`, free physical RAM `4.44 GiB` immediately before the small run; global native `postgres.exe` count `0`.
- Exclusive test directory: `D:\Bostan-B209-qa`, created only after checking it did not exist; no persistent Bostan checkout was modified.
- Exact GitHub source `scripts/ensure-workspace-package-links.ts` blob `35565f2391538b361f1bc0250cde6981d4f324ea`, verified by native `git hash-object`.
- Updated `scripts/ensure-workspace-package-links.test.mjs` blob `0572cbfd4d937568ee426e56767475b9132a3ca5`, also verified by native `git hash-object`, and byte-for-byte committed into this branch.
- `node --test --test-reporter=spec ensure-workspace-package-links.test.mjs` **15/15 PASS, 0 SKIP, 0 FAIL, exit code 0, 3.08 seconds**. The four formerly skipped tests actually passed, not just a static review.
- Global Windows `postgres.exe` remained `0` after the run. No PostgreSQL server started, no admin credentials, user files, third-party packages, paid tools or cloud services used.

The test runner's own per-test fixtures use `t.after` cleanup of uniquely named `bostan-b208-linker-*` temporary trees. On the next step, the exclusive outer B209 QA directory is to be deleted only after verifying its exact source/test hashes, its inventory and no foreign/reparse entries. Do not delete other Bostan QA directories or existing PostgreSQL processes.

## Remaining hard gates

This closes the **native Windows junction regression coverage gap** in B1-188, not Bostan's Windows release qualification. Real forced-crash PostgreSQL `io_worker` proof (#234), clean exact-head compiled HTTP + Better Auth synthetic first-admin/roles/tenancy + Chromium (#237), installed cross-OS acceptance, full root TypeScript7, bwrap, consent/tenant/security/privacy and donor licenses remain open. Source patch #445 and this test enhancement remain stacked Draft, not merged. **RELEASE NO-GO**, no deployment/publishing/Actions/paid provider.
