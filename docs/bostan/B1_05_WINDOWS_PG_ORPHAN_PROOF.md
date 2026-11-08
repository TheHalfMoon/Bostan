# B1-05 — Native Windows PostgreSQL orphan proof is mandatory

Date: 2026-10-28. Bostan is PRIVATE, this branch is a stacked Draft after B1-04 PR #256. No merge, publication, deployment, GitHub Actions activation, customer data or paid model use.

## Actual gaps fixed

1. The B1-04 native Windows authenticated HTTP runner treated `db.cleanup()` returning as sufficient database teardown to emit a qualified HTTP receipt. That is **not enough on Windows**: native `postgres.exe --forkchild=io_worker` workers previously remained after apparently clean embedded PostgreSQL tests (Issue #234). Before B1-05 the receipt explicitly reported `noOrphanPostgresProcessVerified:false`, but it could still say `windowsAuthenticatedHttpQualified:true`. This was a misleading independent qualification gate.
2. The existing read-only PowerShell scanner `scripts/bostan-native-windows-postgres-no-orphans.ps1` ignored `postgres.exe` processes with inaccessible executable paths unless their command line happened to contain the checkout path. When both fields were unavailable, it could report a false clean result. It now increments `UNINSPECTABLE` for **every** PostgreSQL process whose executable cannot be read; this is deliberately conservative and can block qualification when unrelated PostgreSQL processes are hidden. It never terminates processes.
3. Two source-level regression assertions added in earlier PRs were stale: one searched for an obsolete literal `windowsAuthenticatedHttpQualified:true` that the runner no longer used; another expected the removed manual health-polling loop. They were repaired in `scripts/bostan-private-windows-live-http.test.mjs` and the source now includes a separate native orphan-gate regression.

## Implementation

- `scripts/bostan-private-windows-pg-orphan-proof.mjs` is an isolated strict interpreter for the **existing read-only** Windows PowerShell process scanner. It accepts exactly three ordered stdout lines:
  `BOSTAN_WINDOWS_PG_OWNED_PROCESSES=0`, `BOSTAN_WINDOWS_PG_UNINSPECTABLE=0`, and `BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS`; it requires child exit 0, no signal, no error/timeout, no stderr, bounded text, and rejects missing/duplicate/extra lines. It never includes stdout/stderr or paths/secrets in the result.
- The actual Windows HTTP runner invokes the checkout-owned PowerShell scan with explicit `-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ... -Run` **only after server close and successful `db.cleanup()`**, with `timeout:20000`, `maxBuffer:8192`, `windowsHide:true`, and a minimal OS/TEMP-only environment. It doesn't stop any external process.
- Only a verified clean scan emits `BOSTAN_WINDOWS_LIVE_NO_POSTGRES_ORPHANS_PASS`. The strict HTTP proof now requires **16 exact ordered unique stages**, all existing HTTP/session/CSRF/first-admin requirements, plus a distinct `postgresProcessTreeVerified:true`. A scan failure, nonzero owned process count, uninspectable process, timeout, or invalid PowerShell output fails the HTTP receipt and preserves the owned test HOME for investigation. Fixture deletion is now conditional on the independent process proof.
- The explicit receipt field `noOrphanPostgresProcessVerified` reports only the actual scan boolean. **`releaseQualified:false` remains unconditional** because browser/agent/installer and full release gates are still open.

## What was genuinely executed

Isolated local Linux Node **22.16.0**, exact GitHub blob hashes independently verified:

| Source file | Git blob | Executed result |
|---|---|---|
| `scripts/bostan-private-windows-pg-orphan-proof.mjs` | `e1ef99a4abcbb2ed069aef8c0771b3f336dc54e6` | `node --test` **6/6 pass** with exact local test blob below |
| `scripts/bostan-private-windows-pg-orphan-proof.test.mjs` | `767cb1497b737c03a2281b8731e9b7458beda098` | Same 6 tests; includes one real zero-exit Node subprocess **correctly refused without scan evidence** |
| `scripts/bostan-private-windows-http-evidence.mjs` | `c62125fbe5bf7442b5cdf0320193efbaebced19b` | `node --test` **9/9 pass**, including missing sixteenth stage and unverified process tree |
| `scripts/bostan-private-windows-http-evidence.test.mjs` | `e4af4d807ac9bacf072de93fa6ed673dcc47d0ff` | Same 9 tests |
| Windows PowerShell scanner | `ea1144a25493d634c3f8c0c943effc28787fada8` | **NOT executed**: Windows unavailable |
| Native Windows HTTP parent | `3462e95ef2f1f9f2d238f0494184fdf6a0ee3d55` | Isolated JS parser and source integration invariants passed; **NOT executed** on Windows |
| Runner regression suite | `6c639bfba7716361385d48e2a5a4101ee563c46e` | Stale assertions fixed; JS syntax accepted. Complete suite not run on native checkout. |

Combined local pure Node tests: **15/15 passed**, 0 failed, 0 skipped. Evidence interpreter tests used mocked PowerShell output, **not** real Windows OS process enumeration. No Linux test can prove zero Windows `io_worker` workers.

## Safe native acceptance plan

- Current known Windows C: free was ~0.323 GiB, **below** B0-91 >=2 GiB requirement; isolated checkout/TEMP require >=6 GiB. No heavy native PG/Chromium/installations until those safety gates pass. Do not delete user files.
- Authorized desktop connection previously hit monthly quota. Do not circumvent/reconnect while suspended. With authorized access and adequate resources, check out the exact B1-05 head into a *new owned* `Bostan-B105-qa` directory with matching `Bostan-B105-temp`. Use Node >=24.11 and frozen dependency installs.
- Run pure Node test suites, actual native Windows source-server and PostgreSQL/auth first-admin localhost HTTP journey, and the post-teardown PowerShell check. Require 16 ordered real markers, success status, no orphaned owned worker process and no uninspectable process. Verify only test-owned fixtures are cleaned and unrelated PostgreSQL processes untouched. If PowerShell ownership inspection fails, **NO-GO** and preserve the fixture.
- Native Mac latest 16-stage HTTP, Windows and macOS Playwright/Chromium, first real zero-cost agent, source/compiled build, Windows/macOS installers, licensing/security and operational recovery remain separate open gates.

**Bostan PRIVATE; Draft only; release NO-GO until native proof is observed.**
