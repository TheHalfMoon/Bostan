# B5-36 — Reap only owned native Case QA subprocesses after a bounded test

Private Bostan development, 26 October 2026. Do not merge to main, release, deploy, enable Actions, expose customer accounts or incur any paid-model usage. Legally required licensing and provenance unchanged.

## Actual failure and threat model

The B5-35 model-driven native Case experiment timed out in the 8-GiB Mac's native runner preparation stage. The disposable Bostan application gracefully stopped and preserved its failed QA profile for inspection, but its native runnerd and pinned OpenCode descendants were reparented as orphan processes. Manual shutdown was necessary, and a user's unrelated personal OpenCode process had to remain untouched.

Ordinary local Bostan smoke, user processes, normal product runtime, Windows test support and Windows installer behavior must not be affected.

## Change

Only when the independently gated BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E=1 opt-in is active on POSIX, the disposable test launcher starts the Bostan source server with spawn({detached:true}). This yields a new process group whose ID equals the exact launched child PID; a separate own-group record is created only from that successfully launched detached QA child.

- A successful graceful Bostan shutdown still takes place first. Only afterward, the test sends SIGTERM to that owned group to terminate any leaked native provider descendants; it does not mark PostgreSQL as stopped merely because of that signal.
- On failed QA/shutdown/timeout, the existing graceful-stop attempt runs first. The private isolated QA process group receives SIGTERM in finally to prevent native runnerd or OpenCode children remaining alive. Failed disposable profiles stay available for forensic inspection and are never declared clean.
- Strict helper rejects arbitrary, non-detached, current-process, unsupported-platform, invalid-PID or invalid-signal control. ESRCH is harmless (group already stopped); permission errors still surface. The test never enumerates or terminates user processes by their name.
- On ordinary browser/persistence QA, detached mode and group signals are NOT enabled. No production supervisor, live customer service or OS-wide cleanup policies were changed.

This is an extra test-only containment layer, not a promise that an external model will create a report or that all future native engine descendants always remain in the same POSIX process group. Explicit alternate process groups would need additional supervised shutdown qualification.

## Actual checks on Mac

- Real POSIX detached synthetic QA child was spawned and terminated through its owned negative process group ID; calling parent remained alive. No other OpenCode processes were targeted.
- Process owner/mock signal tests: 3/3 PASS.
- Entire Bostan Node source suite: **161 PASS, 0 FAIL, 9 Windows-specific SKIP** (170 total).
- Real private source Bostan+Postgres restart+headless Chromium smoke on this latest branch: **PASS** with page errors 0, blocked external requests 0, clean stop.

The full native model-driven Case remains BLOCKED by B5-35 hardware requirements (and previously failed to produce the verifier report), and the official server full typecheck/build and installed Windows QA remain NOT qualified. Do not treat the clean test process shutdown as a successful model review. Release NO-GO.
