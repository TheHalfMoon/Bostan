# B1-04 — Absolute deadline for Windows private HTTP server startup

2026-10-28. Bostan **PRIVATE**, stacked Draft on B1-03 PR #255. No merge, Actions activation, publishing, deployment, paid-model calls or customer data.

## Actual Windows QA harness defect

The prior `scripts/bostan-private-windows-live-http.mjs` used `for(let i=0;i<180;i++)` around `fetch(/api/health)` with a **1,500 ms** per-fetch timeout and **1,000 ms** wait after each attempt. This meant that 180 attempts were **not** a 180-second wait: when the startup was unavailable for each attempt, the loop could take approximately **450 seconds** (180 × [1.5 s + 1 s]) *before* teardown, obscuring the real source-server startup blocker in Issue #237. This is an actual boundedness error in the test harness; it is not a demonstrated fix for slow Windows TypeScript imports.

## Repair and behavior

- Added `scripts/bostan-private-windows-health-wait.mjs`, with a strictly limited and configurable monotonic elapsed-time deadline (`performance.now()`), default **180,000 ms**, and a secondary maximum **180 probes**. Each request gets the minimum of the remaining budget and 1,500 ms; delays cannot exceed the remaining budget. The actual Node `fetch` uses `AbortSignal.timeout`.
- The helper refuses non-loopback or non-HTTP endpoints before fetching: only an explicit `http://127.0.0.1:PORT/api/health` endpoint with a valid non-system port is allowed. It rejects embedded credentials, query, fragments and other routes; it never returns server JSON or exception messages.
- It only recognizes a healthy Bostan private server when status=200, body status=`ok`, deploymentMode=`authenticated`, deploymentExposure=`private`, bootstrapStatus=`bootstrap_pending` and the body has no `cloud` property. It refuses a public, already-claimed, malformed or invalid-JSON response.
- A failed/closed owned test child stops health polling immediately. The returned receipt contains only `{healthy,outcome,probes,observation,elapsedMs}` with bounded enum-like fields and numeric counters; no credentials, filesystem paths or response bodies.
- Replaced the old 180-attempt loop in the actual Windows auth+DB+HTTP runner with `waitForWindowsPrivateHealth({endpoint,childExited})`, preserving all B1-03 **15 exact ordered auth/CSRF/first-admin proof markers** and B1-02 child-close/PG teardown. Startup failure now records a bounded outcome (`child_exited`, `deadline_exceeded`, `probe_limit`) and probe count.
- Added a source-level regression to the existing Windows HTTP harness test enforcing the helper invocation and the absence of the old 180-iteration loop.

## Verified exact GitHub source and genuine local execution

On isolated Linux Node **22.16.0**:

| Item | Exact Git blob | Evidence |
|---|---|---|
| New bounded health module | `e735732e47193a8715164d7ec0919399bc04c729` | Byte-for-byte match |
| New health tests | `9c478f431439c8e16410bacae58c0ab36b85e363` | Byte-for-byte match; real `node --test` **8/8 pass**, no fail or skip |
| Integrated Windows native QA script | `e2b5ca9440abc50dd0f259718ee0c758fe5d8e4e` | Isolated JS parser accepted; eight static integration invariants passed |
| Updated Windows runner source tests | `9580ede5498e69508e6542d0b60b6f72ccad3cef` | Source present; **full test file not executed in native workspace** |

Two tests used a **real loopback HTTP server** (one successful authenticated/private/pending and one invalid JSON), and a third test exercised three real HTTP refusal states (public, already ready, forbidden cloud field). Five additional test groups exercised deterministic deadlines including fetch+sleep budget (proving fewer than 180 probes under synthetic 1.5s-request+1s-delay stalls), early child exit, request count cap, refusal of foreign endpoints, malformed settings, and failure-safe response parsing.

**Scope:** This is real localhost-HTTP and pure-function testing on Linux, plus static source integration checks. It is **not** an actual Windows 11 Bostan app, Node24 source-server import, embedded PostgreSQL migration, Better Auth journey or Chromium E2E.

## Remaining qualification

- Issue #237: actual native Windows source-server import/startup and authenticated HTTP remains blocked. The prior Windows system C volume had ~0.323 GiB free, below B0-91's minimum **2 GiB**. Workspace/TEMP require >=6 GiB. No heavy native tests or disk deletion until admission succeeds.
- Issue #234: orphaned Windows `postgres.exe --forkchild=io_worker` must be checked independently by PID, executable path and ownership. This change does not touch processes and does not assert 0 orphans.
- Authorized Desktop Commander access reached a monthly quota; do not retry/reconnect to evade the quota. On legitimate restoration, use a fresh *owned* matching `Bostan-B104-qa` / `Bostan-B104-temp` pair, Node24.11+, frozen local dependencies, run pure and native Windows HTTP tests with the 180 s actual startup bound, then examine safe diagnostic stage and orphan process evidence.
- macOS full latest-source 16-stage authenticated HTTP and native Chromium, Windows Playwright, real zero-cost agent, app build/installers, licensing/security remain open.

**Bostan remains PRIVATE, Draft, release NO-GO.**
