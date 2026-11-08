# B1-26 — Compiled Runtime Source Ancestor Admission

Status: PRIVATE stacked Draft engineering only. Parent: B1-25 PR #278, exact head a2d4c8bfde7f6513aef282ac5d018e728d3d3f7d. No merge, publication, deployment, packaging or GitHub Actions.

## Reproduced defect

The B1-25 output admission checked the final compiled source entry using lstat, but did not lstat its parent directories. A normal file reached through a substituted directory symlink was accepted for deletion admission of an existing manifest-owned runtime. This was reproduced with an isolated synthetic fixture: the source dist directory was renamed and replaced with a symlink to the original directory; the existing compiled runtime remained untouched during the RED admission-only test.

## Narrow change

Before allowing output admission, inspect each source ancestor from the filesystem root through the source parent using lstat. Reject missing, nondirectory, symbolic-link and Windows-junction ancestors. The preexisting target-directory checks, exact ownership inventory, digest checks, and regular source-entry check remain intact. No automatic cleanup or deletion is added.

## Actually executed

- Isolated Linux Node 22.16.0 (below the full application's required Node >=24.11.0), no dependencies or esbuild.
- Exact parent source Git blob eed34616669a45aa4c00297aaa2ac926731ad98c plus the new two-test fixture: 1 PASS / 1 expected FAIL (Missing expected rejection).
- Fixed source plus the same two-test fixture: 2 PASS / 0 FAIL / 0 SKIP.
- Fixed source plus exact inherited B1-25 source admission test Git blob cac2150d64e3ef74605f6bc163e451d1002ac351: 6 PASS / 0 FAIL / 0 SKIP total.
- node --check PASS. No destructive operation against the baseline sentinel, customer files or any operator filesystem.

## Unqualified gates

Native Windows and macOS were offline; no native testing, full esbuild compiled server build, PostgreSQL, authenticated 18-stage HTTP, Chromium, agent, installer, backup/recovery or independent security qualification was executed. This does not close hostile concurrent filesystem TOCTOU or partial esbuild output recovery. Issues #234 and #237 remain OPEN. Release NO-GO.
