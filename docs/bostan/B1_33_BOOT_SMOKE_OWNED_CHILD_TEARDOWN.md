# B1-33 — Never signal an exited boot-smoke child PID

Date: 2026-10-29. **PRIVATE** nonpublishing Bostan; exact parent B1-32 Draft #285 `98a9e2a96d92f81b66783fba87f43110f7eae937`. Do not merge, publish, deploy or release.

## Verified production-qualification harness defect

The actual, unmodified `scripts/server-boot-smoke.sh` Git blob **`52da78b982eb72f7ea60a9a197b756dfba868039`** ran:

```sh
if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
  kill -TERM "$server_pid" 2>/dev/null || true
  for _ in $(seq 1 50); do kill -0 "$server_pid" 2>/dev/null || break; sleep 0.2; done
  kill -KILL "$server_pid" 2>/dev/null || true
fi
```

It unconditionally signaled `-KILL` after its graceful-termination polling loop, even if its server already exited. A stale PID can be reused by an unrelated process, which violates the project constraint to never terminate unowned processes.

The exact baseline source (SHA verified against GitHub) and a disposable real HTTP server were exercised on Linux with a Bash `BASH_ENV` instrumentation function that logs each `kill -KILL` invocation before delegating to the actual shell builtin. With the new regression suite, **baseline RED: 2 PASS / 1 FAIL**: a healthy server exited on graceful TERM, yet the baseline then unnecessarily sent KILL.

## Minimal repair

- `scripts/server-boot-smoke.sh` now checks **Bash's actual active child jobs** through `jobs -pr` rather than relying on `kill -0` on an arbitrary numeric PID, both while monitoring early server exit and while cleaning up.
- It first requests TERM from the owned active child, waits a bounded 50 × 200ms, and only sends KILL **if that same child remains an active Bash job**. It `wait`s for its own child so no unowned PID is targeted.
- It disables further EXIT/INT/TERM traps inside cleanup, leaves the existing runtime compatibility environment keys unchanged, and renames **only** its isolated scratch directory prefix to `bostan-boot-smoke`. It does not delete or touch any non-owned file.
- The test suite `scripts/__tests__/server-boot-smoke-owned-cleanup.test.mjs` creates a private synthetic HTTP server, uses a real Bash child process, preserves an external sentinel, and intercepts signals without suppressing the underlying builtin. It covers healthy HTTP ready/clean graceful shutdown with **no extra KILL**, immediate failed server process with no KILL, and an unresponsive **owned** server that receives KILL only after the grace period. Its Bash-specific tests skip native Win32; WSL/Bash is required for Windows harness qualification.

## Actually executed

Local Linux Node.js **22.16.0**, Bash **5.2**. Verified the baseline source byte identity as Git blob `52da78b982eb72f7ea60a9a197b756dfba868039`, reproduced **RED 2/3**. Applied the narrow source patch. Executed source `bash -n` and green regression **3/3 PASS**, 0 FAIL, 0 SKIP. Repeated tests after adding explicit native Win32 skip: **3/3 PASS**. Output source and test Git blobs matched GitHub exactly:
- `scripts/server-boot-smoke.sh`: **`a7310c028abee1cecb83bf9b4e8fadc43f4f5058`**
- `scripts/__tests__/server-boot-smoke-owned-cleanup.test.mjs`: **`2b0a1c0b9838b157046dd75a2192fe622b80c1f1`**

## Remaining gates / release decision

This tests the *boot-smoke harness* with synthetic localhost HTTP, **NOT** Bostan's production server. Remote Windows Abdulaziz and Mac were both offline in this wave, so no native Windows/NTFS builds, full authenticated 18-stage HTTP/PostgreSQL (#237), worker-orphan issue #234, Chromium E2E, first free local agent, or installer qualification. Nested subprocess descendants and adversarial PID reuse remain separately testable; the Bash job approach restricts signals to active direct children rather than proving all OS races impossible.

Repo remains **PRIVATE**, stacked **Draft PRs only**, Actions OFF, no protected-main merge, publishing, deployment, release, npm pack, paid models/cloud or customer data. Product release **NO-GO**.
