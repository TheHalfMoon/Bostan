# B1-25 — Compiled runtime source-entry admission

Status: **PRIVATE stacked Draft; release NO-GO**. No main merge, publication, deployment, package publication, paid compute or customer data.

## Live preflight (2026-10-29 UTC)

- Repository \`TheHalfMoon/Bostan\` was confirmed **private**.
- Protected \`main\` was \`6f6af14a4c9157152d35acd2dcde7ccd1ee9152a\` from the GitHub compare endpoint.
- Latest open Draft PR was #277 at exact head \`d811d05336f90125d2b13459a3608aab573ea374\`, based on Draft #276 at \`c1a89abab327a38863f1947a9332fce3b5d0b979\`; no newer open PR was observed before creating this branch.
- Both authorized Desktop Commander devices were **offline** (Windows Abdulaziz last seen approximately two hours earlier; macbook approximately ten hours earlier). Current Windows/macOS CPU, free RAM, disk, dependencies and process ownership **could not be measured**. Neither device was accessed or modified.
- Isolated local Linux runtime: Node **22.16.0**, approximately **4.7 GiB** available RAM and **30 GiB** free disk. This is below the Bostan full application Node >=24.11 requirement, so only dependency-free unit tests were run.

## Reproduced source-level defect

The exact prior GitHub \`server/scripts/bundle-runtime-output-admission.mjs\` blob \`ead6ff8da74c68c581d8ebef147c46b366ff0c33\` accepted an already-owned output directory even when its original source entry had been deleted, replaced by a directory, or substituted with a symlink. \`bundleRuntime\` immediately calls recursive \`rm(admittedOutdir)\` before invoking esbuild. A missing/non-file source can therefore erase a valid existing compiled runtime and only then fail to build.

The isolated local test fixture used disposable owned files, wrote a genuine SHA-256 ownership manifest with the original helper, then changed only the synthetic source entry. The original exact source produced **1 PASS / 3 FAIL (expected RED)**: all three rejection assertions failed. The existing compiled server file was never deleted in these tests; the destructive caller path was inspected, not executed against an existing runtime.

## Narrow production fix

Before any output admission, \`validateLocation\` now requires the resolved source entry to exist as a regular file and not be a symlink, using \`lstat\` and the existing generic fail-closed error. This protects the missing, directory and linked-entry cases before the caller reaches recursive deletion. It does not change the ownership manifest schema or bypass file-inventory verification.

## Actually executed

- Exact original production blob matched \`git hash-object\`: \`ead6ff8da74c68c581d8ebef147c46b366ff0c33\`.
- Updated production blob: \`eed34616669a45aa4c00297aaa2ac926731ad98c\`.
- New four-test file blob: \`cac2150d64e3ef74605f6bc163e451d1002ac351\`.
- Existing six-test file blob: \`bf966036ccf0b617a51c6c8da22521028aebc499\`.
- \`node --check\` on updated production and new test: **PASS**.
- Genuine isolated Linux Node22.16 \`node --test\` of the **original six tests plus four new tests: 10 PASS, 0 FAIL, 0 SKIP**. The four new tests cover missing source, directory source, symlink source and unchanged regular source.
- All test fixtures were disposable local temporary directories. No operator files, native database, browser, remote devices, customer data, or paid services were used.

## Remaining release gates

This is **not** native Windows/macOS qualification or a full esbuild/server build. Source replacement races after \`lstat\`, hostile output-directory TOCTOU, and incomplete output after a failed esbuild build are **not solved**. Native Windows full 18-stage authenticated PostgreSQL/HTTP and strict zero-orphan proof (#234/#237), Chromium Playwright, first zero-cost live agent, native Mac E2E, installer, independent security/licensing/backup/recovery all remain unqualified. Bostan stays PRIVATE, GitHub Actions OFF, all PRs Draft, release **NO-GO**.
