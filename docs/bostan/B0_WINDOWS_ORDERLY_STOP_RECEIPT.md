# B0-18 — Windows TEMP-only verified local stop (development)

**Status: private Draft, not release-qualified.** Parent: B0-17 PR #45. Branch: `work/b0-disposable-graceful-stop`.

## What changed

A new `bostan app stop --local` command works **only** for a developer's explicitly opted-in Windows TEMP HOME (`BOSTAN_WINDOWS_TEMP_QA=1`), within a full source checkout. It refuses the ordinary Windows user HOME and requires the protected NTFS DACL established in B0-17.

The launcher exposes a loopback-only TCP stop controller on an ephemeral port, authenticated with a random 256-bit token kept in a protected local file. The CLI checks the Bostan managed run lock and PID before asking that controller to stop. On a valid request, the parent sends a private Node IPC message to its managed child. Instead of killing the child via Windows `SIGTERM`, the child calls the application's **programmatic `shutdown("SIGTERM")`** and exits; the launcher then independently shuts down PostgreSQL and removes the lock only after confirming PostgreSQL is stopped. The CLI does not return success until it observes the lock absent and the database stopped (or never initialized).

The installed **CLI-only preview** still refuses application runtime commands. macOS/Linux process behavior is unchanged. The IPC child also attempts a best-effort orderly shutdown if the launcher disconnects; if reporting through a disconnected IPC channel fails, that cannot prevent its own exit. Stop-control metadata corruption is surfaced, but must not skip the separate database shutdown.

## Actual verification — October 24, 2026

- **Windows: 35 pass, 0 fail, 6 POSIX-only tests skipped**, running five focused Node test files. Tests include authenticated loopback stop, wrong/mismatched PID and forged token refusal, source CLI command invoked in a separate process, synthetic empty-database lock verification, real cross-process Node IPC shutdown with exit 0, duplicate/early commands, failure exit 1, disconnection, NTFS DACL and pre-secret ordering.
- **macOS: 32 pass, 0 fail, 9 Windows-only tests skipped** in the same five-module suite.
- **macOS CLI: 17/17 tests passing** after rebuilding preview distribution; installed preview still refuses `app stop`.
- All tests used synthetic data and isolated temporary profiles. No user or customer profile was modified or stopped.

## Honest release gates

A complete **real Bostan server + PostgreSQL native Windows stop E2E** was **not performed** in this phase. The tests establish process IPC, CLI authentication, and stop-state verification separately, rather than qualifying a full native user workflow. Active agent/model run drains, pending requests and shutdown under load, interactive UI stop, unexpected launcher crash with running PostgreSQL, temporary control metadata recovery, Windows service/job ownership, hard ACL adversaries, installer packaging and macOS standalone app also remain open.

The verified stopped database is not necessarily evidence that the application completed every higher-level task. A failed stop must never be relabeled success.

**NO-GO. No public release, no deployment, no merge to main and no GitHub Actions enablement.**
