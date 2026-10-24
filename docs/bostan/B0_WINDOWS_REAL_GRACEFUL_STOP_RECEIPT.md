# B0-19 — First complete Windows source Bostan orderly-stop E2E

**Result: PASS for one full synthetic Windows source-runtime/real PostgreSQL cycle. Overall release NO-GO.**

Parent: private Draft PR #46, commit `af8ed7a78a927dad75c7886d48e820e9fc8b979a`.
Branch: `work/b0-windows-real-stop-e2e`. Device: authorized Windows Abdulaziz, Node 24.19, pnpm 9.12, PostgreSQL 17.11.

## Scope and dependencies

All Bostan server data lived under a fresh private **TEMP HOME** with explicit
`BOSTAN_WINDOWS_TEMP_QA=1`, a verified protected NTFS ACL, no system service,
no user HOME modifications, and no production data.
Portable EDB PostgreSQL 17.11-4 binaries were fetched from the vendor; the
archive's SHA-256 was verified before extracting required bin/lib/share files:
`b9424ee7bc60b52450ff910a3630225df32e633f3cb29c1d126d9299d59aea28`.
The original archive was deleted after extraction. Full source checkout,
`pnpm install --frozen-lockfile --ignore-scripts`, plugin SDK dependency
build and `pnpm --filter @paperclipai/ui build` all completed successfully.

## Real end-to-end evidence

1. The first Windows source-app attempt, using the exact B0-18 branch, passed
   `bostan app doctor`, initialized/started a **real** PostgreSQL 17.11
   cluster and created private runtime lock/stop controller. The server did
   **not** reach HTTP 200 within the B0-18 limited 240-probe startup window.
   The launcher reported this honestly and stopped PostgreSQL, clearing
   the lock and stop-control metadata, without disturbing the disposable DB.
2. After increasing **only the disposable Windows QA startup budget** to a
   finite 360 probes, the next launch **succeeded** and printed the local
   application address. The parent launcher exited with **code 0** when
   subsequently stopped through the new command; elapsed process lifetime
   was approximately 228 seconds, including its cold server import.
3. A separate client verified live
   `GET http://127.0.0.1:41811/api/health` returned
   `status=ok`, `deploymentMode=local_trusted`,
   `deploymentExposure=private`.
4. Live `POST /api/companies` created the synthetic organization
   `Bostan Stop E2E Synthetic Windows 2026-10-24`. Live
   `GET /api/companies` returned the same exact UUID and name.
5. A **second independent Windows PowerShell/Node CLI process**, using
   the same explicitly isolated TEMP HOME and source checkout, ran
   `bostan app stop --local`. Its output was
   `Bostan local stop confirmed. PostgreSQL: stopped`;
   process exit code **0**. This exercised the real managed child wrapper,
   authenticated loopback control and parent/child IPC path against actual
   Bostan services.
6. Independently checked after the CLI returned: no HTTP response, no
   `run.lock`, no `stop-control.json`, no PostgreSQL `postmaster.pid`;
   `pg_ctl status` returned code **3** confirming stopped cluster.
7. Restarted that **same** PostgreSQL cluster independently with a fresh
   loopback port. Queried the actual `companies` table for the created
   synthetic UUID and obtained the identical organization name. Shut down
   PostgreSQL cleanly once again and verified no postmaster PID remained.
   This verifies persistence through the graceful shutdown cycle rather
   than only trusting API or launcher output.

### Change after this live qualification

A subsequent small isolation fix propagates the already-verified Windows
TEMP-QA indicator to the managed child, so its diagnostics can print
privacy-safe *module import* and *service startup* timing milestones in the
private local startup log. This marker propagation was covered by focused
Node unit tests. **The full live app E2E above was run on commit
`ad9ee27b2690aabbf1b89276a6932b6a3d53f15c`, before that
diagnostic-only marker propagation fix; do not claim a separate full-app
E2E of that later commit.**

### Regression tests

Five focused source/runtime/ACL/IPC test files execute on Windows with
explicit skips for POSIX-only fixtures; earlier B0-18 baseline: **35 pass,
0 fail, 6 POSIX-only skips**. The new Windows-QA startup cap and isolated
backend marker have standalone regression assertions.

## Still NOT a release candidate

- Windows uses a full **developer source checkout**, installed Node/pnpm,
  and portable external PostgreSQL; there is no signed standalone desktop
  installer or safe upgrade/migration lifecycle.
- High Windows cold-start latency and substantial RAM consumption are not
  production-qualified, despite the successful bounded QA startup.
- One orderly-stop cycle does not prove behavior with active agent sessions,
  concurrent HTTP requests, multi-agent recovery, sudden power loss,
  crashed launcher with live agents, or every privacy/NTFS edge case.
- Default agent execution on Windows, offline model operation, end-user
  security assessment, macOS+Windows packaging, code signing, and release
  gates remain open.
- Tests are synthetic; no actual company or user data and no paid provider.

**Status: NO-GO. GitHub repository stays private; all PRs Draft, main
unchanged, GitHub Actions disabled. No deploy, publication or merge.**
