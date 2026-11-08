# B1-74 — Reject ambiguous Windows PostgreSQL PID marker types

Date: 2026-10-30. Strictly PRIVATE / ZERO-COST / NONPUBLISHING. Exact stacked parent: Draft PR #328, commit `fdb25fa085c51e674568d1b0a7247e958c576240`.

## Source-level defect and RED reproduction

The Windows-only synthetic database teardown helper used `fs.existsSync(postmaster.pid)` for pre-stop, post-stop, and post-worker-proof checks. That API follows symlinks and reports a dangling symlink as absent. A dangling `postmaster.pid` could therefore be accepted as `already-stopped` after two clean injected process snapshots. A live symlink or directory at that marker could instead reach the `pg_ctl` runner without proving an ordinary marker file. A dangling symlink introduced during the worker proof was also missed by the final check.

Four new controlled Mac regression tests were RED on the exact B1-73 parent: **15 PASS / 4 FAIL**. They cover dangling symlink before inspection, symlink to a live target before `pg_ctl`, directory masquerading as PID marker, and dangling symlink introduced during inspection. These are synthetic file identity tests, not observations of a real Windows PostgreSQL attack or crash.

## Minimal test-only mitigation

A single `pidMarkerPresent` helper uses `lstatSync` rather than `existsSync`. Only an ordinary regular file is accepted as a present PID marker; `ENOENT` means absent; symlinks, directories, inaccessible metadata, and unexpected filesystem errors fail closed with fixed privacy-safe messages. All three marker-check sites now use the same rule, including the final post-quiescence check. No `pg_ctl` call occurs for a malformed existing marker. No foreign process is terminated, no retained fixture deleted, and production server behavior is unchanged.

## Objective receipts

- Authorized macOS Node 26 / Vitest 5, one worker, 1024 MiB cap: **21 PASS / 0 FAIL** across 19 Windows-stop policy cases and 2 Windows template-policy cases. Four previously RED cases are GREEN.
- Targeted TypeScript 7 strict `--noEmit --ignoreConfig` check of the changed helper under a 768 MiB heap: **EXIT 0**.
- `git diff --check`: **EXIT 0**.
- The three symlink-specific tests are explicitly skipped on Windows, where symlink privileges vary; the non-file directory regression is cross-platform. Native Windows marker handling has **not** been independently qualified.
- Read-only native Windows admission before this change: C **7.20 GiB**, D **11.45 GiB**, free RAM **2.46 GiB**, observed `postgres.exe` count **0**. RAM is below safe heavy-test admission; no native Windows PostgreSQL, packed runtime, 180s E2E, Better Auth/HTTP, or Chromium was run.

## Stack and release constraints

PR #326 and PR #327 are divergent children of #325; #328 builds on #327. This B1-74 change builds on #328, **not** #326. #327's missing-directory refusal remains stricter than #326's alternative clean-snapshot receipt; no divergent changes were silently merged.

Remaining: exact PID/parent/creation-time owned-process graph, real multi-suite Windows no-orphan proof (#234), packed Windows startup and 18-stage auth/HTTP (#237), Linux, browser, offline agent, installers, privacy/security, copy-first license/NOTICE provenance. Marker validation is not atomic against replacement after the last check. Release **NO-GO**.

No merge to main, GitHub Actions enablement, publish/deploy/release/npm pack, paid model/compute/cloud, customer data, unowned process termination, or local disk cleanup.
