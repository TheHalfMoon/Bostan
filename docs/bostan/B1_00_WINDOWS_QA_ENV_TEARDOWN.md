# B1-00 — Windows authenticated HTTP QA isolation and teardown correctness

Date: 2026-10-28. Private, stacked on B0-99 Draft PR #251. No merge, release, publishing, Actions activation or paid provider calls.

## Reproduced defects in the Windows QA harness

The existing `scripts/bostan-private-windows-live-http.mjs` subprocess was created using `env: {...process.env, ...}` and then tried to delete selected known credential prefixes. This blacklist does not cover many sensitive operator variables (for example `GITHUB_TOKEN`, `GH_TOKEN`, `DATABASE_URL`, alternate AI/cloud provider tokens, CI credentials, user profile and unrelated project settings). A disposable authenticated server must not inherit those values.

The harness also printed a green real-HTTP/first-admin JSON receipt **before** the `finally` block stopped its server and called `db.cleanup()`. If shutdown failed or left uncertain processes, the receipt could mislead downstream automation. It deleted the owned HOME even after failure to prove safe teardown. Its catch printed some raw exception messages that might contain environment variables, paths or connection strings.

## Engineering repair

- Added pure `scripts/bostan-private-windows-qa-env.mjs`, `buildPrivateWindowsHttpQaEnvironment()`, allowing only minimal OS loader keys from inherited environment (`SystemRoot`, `WINDIR`, `ComSpec`, `PATHEXT`, `PATH`, `SystemDrive`, `PROCESSOR_ARCHITECTURE`, `NUMBER_OF_PROCESSORS`). The names are matched case-insensitively as Windows typically has `Path` not `PATH`.
- Fresh writable locations `HOME`, `USERPROFILE`, `TMP`, `TEMP`, `APPDATA`, `LOCALAPPDATA`, `XDG_CONFIG_HOME`, `PAPERCLIP_HOME` and `PAPERCLIP_CONFIG` are set under the test-owned disposable HOME. APPDATA/LOCALAPPDATA directories are created before spawning.
- The helper refuses missing owned fixture/secret, non-loopback or non-HTTP health origin, invalid port, or a DB connection not pointing to loopback PostgreSQL. It then installs only explicit synthetic authenticated/private Bostan app settings; no managed Cloud or provider credentials are copied.
- Windows live HTTP parent now tracks whether tests completed, whether the server has truly exited (`exitCode` **or** `signalCode`), and whether `db.cleanup()` and owned HOME deletion succeeded. If the child remains uncertain, it never deletes its data directory and reports a required manual **owned** inspection. The new success JSON is written only **after** those gates, never before `finally`.
- Raw error messages/stacks are replaced by a finite error-type code. **Important remaining limit**: `db.cleanup()` returning does not independently prove that all Windows PostgreSQL `io_worker` descendants have exited. The success receipt explicitly keeps `noOrphanPostgresProcessVerified:false` and overall `releaseQualified:false`; Issue #234 remains open.

## Verified results

On isolated Linux Node **22.16.0**, actual built-in Node runner for the exact two GitHub blobs `scripts/bostan-private-windows-qa-env.mjs` (Git blob `3a7c2f15ab34060266515ce8d3c2e607ad623642`) and its tests (Git blob `d0759ce641271f7e981105c6167ae7696af1a7c0`): **4/4 PASS**, no fail or skip. Tests cover: operator keys and secrets never forwarded, all unknown inherited variables refused, invalid production/remote/Cloud DB origin refused, and a **real spawned local Node child** receiving only the allowlisted environment with no GitHub token, provider key, injected `NODE_OPTIONS`, or public Cloud URL. This exercises child-process environment isolation on Linux with Windows-formatted fixture values; it is **not** a native Windows process test.

The exact GitHub Windows HTTP script at Git blob `1b53472ee4da5673f88a169880a8aaf68b45ba69` passed an isolated JavaScript syntax compilation and **8/8 source-level static safety assertions** checking allowlisted environment, owned directories, no raw error leaks, both teardown results before PASS, exact ownership marker, no unsupported orphan-process claim and disk admission order. These are **static checks**, not real Windows HTTP or DB tests. Added a Node source-level regression suite `scripts/bostan-private-windows-live-http.test.mjs` to the branch; its complete test execution on the branch remains unverified.

## Native acceptance still required

1. Windows C: previously had **~0.323 GiB free**, below the minimum **2 GiB** system threshold in B0-91. Do not install/run heavy PostgreSQL, server or Chromium until the admission check passes. Do not delete user files to force headroom.
2. In a newly owned disposable `Bostan-B100-qa` checkout and `Bostan-B100-temp` on a volume with >=6 GiB free, run `node --test scripts/bostan-private-windows-qa-env.test.mjs scripts/bostan-private-windows-live-http.test.mjs`, relevant scoped server tests, and the opt-in authenticated private Windows HTTP test. Require actual 200 private health, synthetic signup session, first-admin claim and role/tenant coverage, plus a clean completed receipt.
3. Inspect native Windows process tree for **zero owned PostgreSQL io_worker descendants** after every run; Issue #234 is separate and **not solved** by receipt timing alone. Verify cleanup of only the owned directory and that no other PostgreSQL or user processes were touched.
4. Retake Mac full-source PostgreSQL/HTTP+16-stage CSRF harness, Playwright Chromium, first real zero-cost agent flow, reproducible server builds and installers. No full release until actual cross-platform proof.

**Bostan PRIVATE, stacked Draft, release NO-GO.**
