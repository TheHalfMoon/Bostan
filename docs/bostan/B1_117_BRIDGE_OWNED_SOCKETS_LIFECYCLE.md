# B1-117 — Release bridge-owned sockets when sandbox agent exits

Date: 2026-10-31 Asia/Riyadh. PRIVATE repository, zero-cost, DRAFT / UNMERGED. Parent private Draft B1-116 #372 exact HEAD `ea5af6c760581d5bd8409e713acc0bd3087bbe76`. No release, publish, deploy, main merge, Actions or paid service.

## Verified actual code defect

`packages/adapter-utils/src/local-process-sandbox.ts` generates a Node `bridge.cjs` via `createNetworkProxyBridge` inside the sandbox's network namespace. The bridge creates a loopback TCP listener, opens an upstream UNIX socket for each agent connection, then starts the requested agent child. Original implementation called `child.on("exit", (...)=> server.close(callback))`, but **server.close only calls back after all accepted TCP connections terminate**. An active bridge connection could stay open indefinitely after the child exited, so the bridge process itself remained stuck and the sandbox runner could fail to finish. Original child `spawn` errors also had no `error` listener, and an inherited SIGTERM/SIGINT forwarding handler could intercept a termination signal re-raised after child exit.

### Actual independent RED reproduction

On model-side Debian Linux Node v22.16.0, reproduced the exact old bridge lifecycle using its existing Node source, a synthetic private loopback+UNIX socket server, a child that calls `process.exit(0)` shortly after startup, and a still-connected loopback client. **Old bridge remained alive after the child exited** at the 800ms probe, and was explicitly killed and all test-owned files/sockets removed. The reproduction makes no external network calls and uses no customer credentials. This is a real process-lifecycle result, not a claim of an external exploit.

## Code fix

At source commit `0f4cae77f4d5e9e62504e5a9be8a2601c7747a92`:

- Track **only bridge-owned client and upstream sockets** in a Set. On socket close, remove it and close its opposite half, preserving successful live bidirectional forwarding while agent runs.
- Switch from `child.on("exit")` to `child.once("close")`. Before waiting for bridge server.close, **destroy all tracked bridge sockets**, avoiding indefinite bridge lifetime after child has exited.
- Handle `child.on("error")`, logging the failed spawn without an unhandled EventEmitter error; close the bridge and return a nonzero exit when spawn fails.
- Use named SIGTERM/SIGINT forwarding listeners; detach those listeners before propagating the child termination signal so re-raising the signal cannot be intercepted by the bridge again.
- Export `createNetworkProxyBridge(listenPort = 31337)` with the production default unchanged; injected ephemeral port is used only in tests to avoid conflicts. No new dependencies, changes to host/port authorizations, filesystem mounts, namespace privileges, cost, or any user data.

## New tests and actual validation

The **checked-in Bostan** `packages/adapter-utils/src/local-process-sandbox.test.ts` now includes two new Linux-gated integration tests (commit `fc854c421e863cf9d38081f6c2d361f5b305c387`):
1. The generated bridge is run as a real child process with a *held-open* synthetic TCP-to-UNIX tunnel; after its synthetic agent exits 0, bridge must terminate with exit 0 within a bounded period and release its owned sockets. Uses a reserved ephemeral port rather than production 31337.
2. Agent executable missing (ENOENT): generated bridge must exit nonzero and produce the expected spawn failure diagnostic instead of remaining alive.

**These two checked-in Vitest tests were AUTHORED and COMMITTED but NOT EXECUTED in this wave.** Do not infer TypeScript compilation or green source-native tests.

Actual native model-side Linux Node22 test of equivalent full bridge JavaScript, using local loopback and private UNIX server only:
- Old bridge with a held tunnel: stayed alive after agent exit (**RED, reproduced**).
- New bridge with held tunnel: destroyed owned sockets and exited 0 (**GREEN**).
- New bridge with a nonexistent child executable: emitted a clear spawn failure and exited with code 1 (**GREEN**).
- All owned test child processes, sockets and temporary files explicitly cleaned; no Mac/Windows/other user data touched.

Full Bostan repository QA **NOT RUN**. Model-side test execution used standalone JavaScript equivalent to the bridge string, not the checked-in full TypeScript module, actual Linux `bubblewrap`, Vitest, TypeScript 7 or installed applications.

## Frozen source-native gate alignment

The private repo's source-native Linux qualification gate `scripts/bostan-private-linux-sandbox-gate.sh` was repinned after the code/tests changes to the exact GitHub blobs:
- `packages/adapter-utils/src/local-process-sandbox.ts`: `6a8351c5c26c47e00567cbf0d4895684f5419393`
- `packages/adapter-utils/src/local-process-sandbox.test.ts`: `06f54337543d34a92015b3a2bcef587559e94b2d`

Pin commit: `48d80b4a89faf266ca937cd60a1e47a0db004b25`. Original B1-112 gate evidence document updated at `7881d542b9cfb610a4c2472607f43d9ef4771dd3`. All previously added worktree-integrity and path-ancestor controls remain in gate.

## Release posture / next gates

**NO-GO** until actual B1-117 source-native Linux 4-suite Vitest, full adapter-utils TS7 typecheck and `bubblewrap` checks run successfully from an owner-marked disposable private checkout. Run the companion Linux gate integrity regression first. Then qualify installed Windows/macOS/Linux product, repeated real PostgreSQL load/crash hygiene, tenant privacy/security, agent tool execution approvals and upstream licenses/NOTICE/provenance. Desktop Commander previously reported monthly usage exhausted and explicitly instructed no retry/reconnect; this wave did not call DC. Keep all stacked PRs PRIVATE DRAFT UNMERGED, do not make public/enable Actions/merge main/release/deploy/publish or delete required notices.
