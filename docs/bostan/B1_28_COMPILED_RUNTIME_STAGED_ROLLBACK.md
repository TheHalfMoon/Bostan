# B1-28 — Stage compiled runtime and restore the last owned bundle on promotion errors

Date: 2026-10-29. GitHub `TheHalfMoon/Bostan`, strictly PRIVATE/nonpublishing. Based on B1-27 Draft PR #280 exact head `46bc5f88ce33954aa2a4956d795591d003d83ac4`. No protected-main merge, release, deploy, package publication, GitHub Actions or paid compute.

## Problem

B1-27 correctly calls esbuild with `write:false` and validates the full output before replacement, but then recursively removes the prior runtime and writes the new files directly. A successful build followed by a failed output-file write or SHA-256 ownership-marker write can therefore strand a partial runtime and erase the last working one.

## Narrow change

`server/scripts/bundle-runtime-commit.mjs` now:

1. Continues to enforce existing destination, source, symlink, generated-file naming and 512 MiB in-memory / 10,000 generated-file admission.
2. Writes all output bytes into a private same-volume sibling staging directory created with `mkdtemp`, using exclusive file creation. The last owned runtime is untouched during this step.
3. Rechecks the exact existing destination admission, then moves the existing runtime to an unpredictable sibling rollback directory and promotes the complete stage by same-volume directory rename.
4. Records the original Bostan SHA-256 ownership manifest after promotion. If the promotion or marker recording fails, attempts to restore the prior runtime from the rollback directory. It never recursively deletes the failed newly promoted directory; such an output is moved to an isolated rejected sibling.
5. Removes a previous backup only after independently verifying its original ownership marker, exact source/outdir binding, generated filename set and byte-for-byte SHA-256 content. If a foreign file appears in the backup, the backup remains intact. An empty previous directory is removed only with nonrecursive `rmdir`.
6. Cleans a leftover staging directory only if every file, name and byte is verified to match the exact just-generated output set. A partial or externally modified stage is deliberately preserved for manual inspection.

## Actually executed — exact committed blob parity

On isolated Linux Node.js v22.16.0, with synthetic disposable `os.tmpdir()` fixtures, source syntax and two dependency-free test files were executed together:

- New `server/scripts/bundle-runtime-staged-rollback.test.mjs`: **8 PASS, 0 FAIL**. Covers normal stage/promotion and verified backup cleanup; forced second-rename error followed by rollback; failed ownership-marker registration followed by rollback; compilation failure retaining the old runtime; late admission refusal; invalid/escaping/duplicate source outputs; first build with empty target; and retention of a backup containing a foreign file.
- Existing B1-27 compatibility tests, locally copied unchanged: **6 PASS, 0 FAIL**.
- **Combined: 14 PASS, 0 FAIL, 0 SKIP**; `node --check` PASS.
- Verified exact native Git blob identities of locally executed files and newly pushed GitHub files: production `bc271144d5d1319c683ebf2aae7e59f538469980` and new regression test `16a71f715950300117c571e45337b669fe0120cc`. No test result is inferred from an unexecuted diff.

## Limitations and required gates

**Not a fully atomic directory exchange or crash-safe upgrade.** Power loss between moving the previous runtime to rollback and renaming the staged output may leave the prior valid runtime in its sibling backup until a separately reviewed recovery procedure restores it. If rollback itself fails, fail closed and preserve the backup; never erase unverified content. Adversarial concurrent filesystem substitutions between verification and rename/removal remain out of scope. In-memory esbuild output plus on-disk staging temporarily increases memory and disk needs.

Both authorized Windows and Mac desktops were OFFLINE during this wave. The real pinned Windows esbuild0.28.2 compiled Bostan server, 18-stage authenticated localhost HTTP/BetterAuth, multi-suite embedded PostgreSQL orphan process proof (#234), full source startup (#237), Chromium E2E, offline no-cost agent task and installers were NOT run. Product release **NO-GO**. Do not claim production runtime complete.
