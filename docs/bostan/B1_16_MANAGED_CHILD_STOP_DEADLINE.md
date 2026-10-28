# B1-16 — Bound managed Bostan backend stop after parent loss

Date: 2026-10-29. PRIVATE, zero-cost, Draft-only, nonpublishing. Stacked on exact B1-15 PR #267 head `fccfc7dcf615e45bbae1c3b80ec04f9538409d01`.

## Production-path failure reproduced before the repair

The managed backend child listened for `bostan:managed:stop` and parent IPC `disconnect`, but awaited startup and then `instance.shutdown("SIGTERM")` with no deadline. If either promise never settled, the child could keep its HTTP listener, IPC and database sockets alive indefinitely after the launcher disappeared. This violates the intended owned-process shutdown contract and can prevent safe database teardown. B1-15 had repaired failed startup exceptions; it did not bound *shutdown* or a stop requested during a stuck startup.

A new dependency-free suite executed against the **exact unmodified B1-15 source blob** `45675644ff52f61000ff0916351e69ec410f03d5` in an isolated local Linux Node v22.16.0 workspace. **All four new regressions failed (0/4 pass)**: hung shutdown, hung startup after parent disconnect, late shutdown incorrectly reporting success, and a genuine separately spawned Node child that remained alive with IPC connected until a 2.5-second test watchdog killed only that owned child. The suite used synthetic promises and no database, customer data, network providers or remote machine.

## Minimal production fix

`scripts/bostan-managed-server-child.mjs` now starts a single bounded stop watchdog **at the first explicit stop or IPC disconnect**, even if `startServer()` has not settled. The production default is 30 seconds. The optional third-argument `stopTimeoutMs` (1–60,000 ms; invalid values fall back to 30 seconds) is internal test injection, **not** an environment or operator override. The watchdog is unref'd and cleared on a completed shutdown. Expiration sends the existing `bostan:managed:stop-failed` acknowledgement when IPC is connected, then exits nonzero; disconnected IPC is best effort. A one-shot report guard prevents late success or duplicate exit after a failure. Successful graceful stop still exits zero, and the B1-15 secret-safe startup catch is unchanged.

**Safety tradeoff:** forced process exit does not prove all server or PostgreSQL resources drained gracefully. The parent must continue to treat a nonzero stop as failure and preserve recovery/ownership checks. This patch does not kill arbitrary PIDs or claim orphan-free PostgreSQL. It addresses one bounded backend-child lifecycle failure only.

## Actually executed (isolated local Linux, not native Windows)

- Local host: Linux, Node v22.16.0, approximately 5.8 GiB total RAM / 4.7 GiB available, 30 GiB free overlay disk. Only dependency-free source and test processes ran under `/mnt/data/Bostan-B116-qa`; no dependency install or service started.
- Baseline B1-15 source matched GitHub blob `45675644ff52f61000ff0916351e69ec410f03d5`; red tests **0/4 PASS, 4 FAIL**. The real owned child was terminated by the test watchdog.
- Fixed production source exact GitHub/local blob: `d9f4526b7cd297906d674c812c30007255458b9d`.
- New six-case test exact GitHub/local blob: `d42f97a9bb6a87d68399c978c5dc596d4124e61e`.
- Existing B1-15 eight-case test exact GitHub/local blob: `bb6ee8bc9f3b745f289ac0266fef2105a9f20497`.
- `node --check` on modified production source: PASS.
- `node --test --test-reporter=tap scripts/bostan-managed-server-child.test.mjs scripts/bostan-managed-server-stop-timeout.test.mjs`: **14 PASS / 0 FAIL / 0 SKIP**, including actual separate-process Node IPC success, startup failure redaction and hung-shutdown forced exit.
- No native Windows/macOS, real PostgreSQL, complete authenticated HTTP server, Chromium, agent or installer was run in this wave.

## Remaining independent release gates

Issues #234 (real Windows PostgreSQL io_worker orphan verification) and #237 (fully booted Windows authenticated HTTP/Chromium) remain open. Repeat the managed stop deadline tests on Windows Node >=24.11 and macOS, then real owned DB/server teardown with no remaining processes, 18-stage authenticated HTTP, compiled build, first zero-cost agent, Chromium E2E, installer, backup/recovery, privacy/security/license checks. Windows last observed free RAM ~1.25 GiB below >=2 GiB heavy-test gate; do not bypass disk/memory admission. Keep Bostan PRIVATE, Actions OFF, Draft PR only, no main merge, paid services, operator-file cleanup, publishing, deployment or release. Overall **NO-GO**.
