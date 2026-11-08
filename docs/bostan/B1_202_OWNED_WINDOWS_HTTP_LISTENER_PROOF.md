# B1-202 — Owned Windows localhost HTTP listener admission

## Source-backed gap

The native Windows private HTTP runner reserves an ephemeral IPv4 loopback port, releases the reservation, and later spawns a Node server. The existing `/api/health` probe alone cannot establish that the process answering on that released port is the specific child the runner started. A foreign process could bind in between. This is a race exposure identified by source inspection, **not an observed customer-data incident**.

## Repair

Before sending synthetic Better Auth signup credentials or session requests, the runner now requires two independent, read-only `Get-NetTCPConnection` listener snapshots separated by 125 ms. Each snapshot must contain exactly one listener on the selected port, with exact local address `127.0.0.1` and owning PID equal to the still-live `ChildProcess.pid`. The scanner uses the already pinned Windows PowerShell executable, bounded output and timeout, and returns a fixed error on any ambiguity, foreign/wildcard listener, denied inspection, child exit, or changing PID. It never kills or deletes a process.

The proof is mandatory after healthy HTTP preflight and before the first anonymous claim or signup. The existing exact ordered HTTP evidence stages remain unchanged; failure enters the established owned-child and database teardown path. The receipt `BOSTAN_WINDOWS_LIVE_OWNED_HTTP_LISTENER_PASS` is additional diagnostic evidence, not a release qualification.

## Focused native isolated evidence — 2026-11-02

- Exact committed helper blob `27b1e4c0c27a497ce0a956c299cbb67b5b4576e6`.
- Exact committed test blob `a7c238c5cbe8e1070dbf7d9b65e9f0e7bd979a09`.
- Linux Node 22.16.0: **8/8 native `node:test` synthetic listener-contract cases PASS**, zero skips, exit 0; `node --check` PASS.
- Coverage: two matching samples; foreign/reused PID in either sample; wildcard and IPv6 listeners; duplicate/missing/malformed rows; child exit at every proof boundary; inspector/pause failure; invalid port/PID; healthy endpoint without listener ownership.
- Isolated Linux tests use an inert OS-binary resolver stub and **do not execute PowerShell or prove native Windows listener behavior**.
- No PostgreSQL, browser, real HTTP, customer data, remote device, or foreign process/file was touched.

## Limitations and remaining gates

This is bounded temporal evidence, not an atomic port reservation or a kernel-attested continuous listener lease. A privileged attacker can still race after the final sample; native Windows `Get-NetTCPConnection` behavior and the full runner remain unqualified. It does not close #237 compiled authenticated Chromium acceptance or #234 genuine repeated forced-crash PostgreSQL zero-orphan proof. Full TS7/Vitest, Linux rootless bwrap, Mac/Linux PostgreSQL cache, installed Windows/Mac/Linux E2E, privacy/consent/tenant/security and donor provenance remain outstanding.

**Private Draft stacked on #458. No main merge, Actions, release, deployment, publication, paid provider, foreign cleanup or device quota bypass. RELEASE NO-GO.**
