# B1-82 — Reject control characters and alternate-stream colons in Windows CIM executable identity

**Scope:** strictly private, zero-cost, nonpublishing, test-only Windows PostgreSQL cleanup. **Release: NO-GO.**

## Exact lineage and safety admission

Parent B1-81 Draft PR #336: `work/b1-81-windows-pid-marker-preflight`, SHA `09f2794383584f93fddde58686a27288915efebb`. No changes to `main`; the repository was verified PRIVATE, `main` `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a`, `protected:false`. GitHub Actions must remain disabled.

Authorized Mac Desktop Commander device `93340dea-e68f-4d6f-9aea-d8fb64bae04a` was online. Native Windows device ID `62835bd9-9ffe-4bd5-9010-6ac23b2d7223` did not match previously authorized `6641fb27-1a94-40b7-a76d-06e5e61a49af`; **no Windows execution or writes**. Mac had 39 GiB free, 56% memory free, unrelated PostgreSQL processes; none touched. Existing QA checkout had unrelated `.qa-playwright-browsers/` untracked and was not modified. Isolated owned detached worktree was created from the exact parent for testing.

## Reproduced defect

The CIM process snapshot is filtered by `Name='postgres.exe'`. The path identity normalizer previously rejected NUL/CR/LF but accepted other ASCII control characters embedded inside an executable path, and accepted extra `:` characters after the drive prefix. Such metadata was treated as a different, foreign executable rather than ambiguous, permitting a false `already-stopped` result after two clean snapshots. This is an unsafe *classification* of synthetic CIM rows; it is **not** evidence of a real foreign process or of Windows exploitation.

A new focused regression exercises a path with an embedded tab, an embedded BEL character, and a path with an NTFS alternate-data-stream colon. Before the source fix on exact B1-81: **40 PASS / 1 FAIL / 1 SKIP**; the first malformed path incorrectly resolved `already-stopped`. No native process was stopped.

## Narrow fix and objective tests

- Reject ASCII control characters `0x00–0x1F` and DEL `0x7F` anywhere in the original CIM executable path.
- Reject extra colons outside the one canonical `C:`-style drive prefix, including UNC and extended-length aliases. Keep valid anchored drive, UNC, and extended-length paths accepted by existing regressions.
- Preserve fail-closed errors without printing paths, command lines, environment, secrets, or customer data. Do not change production server, subprocess termination, fixture cleanup, or model behavior.
- Authorized Mac Node 26 / Vitest 5, one worker, 1024 MiB: **41 PASS / 0 FAIL / 1 SKIP** (42 tests). The loop covered all three malformed paths.
- Targeted TypeScript 7 `tsc --noEmit -p packages/db/tsconfig.json --pretty false`: **EXIT 0**. `git diff --check`: **PASS**.

## Unclosed release gates

No real native Windows PostgreSQL multi-suite orphan proof (#234), exact PID/parent/creation-time and cluster ownership proof, packed server startup and 18-stage Better Auth/HTTP (#237), Chromium, offline agent, installers, Linux, security/privacy, or license/NOTICE qualification. Do not merge `main`, enable Actions, publish/deploy/release/npm pack, run paid models/cloud, delete retained fixtures, kill unrelated processes, or run heavy Windows tests without resource and ownership admission.
