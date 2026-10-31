# B1-140 — Refuse duplicate raw HTTP Host fields

Status: **PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO**. Stacked on B1-139 PR #396 at exact parent `5ca42f1a20ec81435a3ddf5fe621a98ee1656304`. No main merge, Actions, publication, deployment, paid providers or customer data.

## Real finding

The private hostname middleware previously called `req.header("host")`. Node's HTTP/1.1 server retains the **first** Host field in normalized `req.headers.host`, while `req.rawHeaders` retains every raw Host occurrence. Thus a raw request with `Host: localhost:3100` followed by `hOSt: blocked.invalid:3100` could be accepted by the middleware even though it carries two conflicting authorities. A downstream consumer or intermediary may interpret duplicate fields differently. This is an **authority ambiguity / fail-closed validation defect**, not evidence of bypassing authentication or network isolation: the Host header remains attacker-controlled and the private hostname guard is not an authentication boundary.

## Test-first and minimal change

Added four source-native Vitest cases in `server/src/__tests__/private-hostname-guard.test.ts` that send actual HTTP/1.1 wire frames through an ephemeral loopback Express listener: allowed-first / denied-second, denied-first / allowed-second, identical duplicate allowed Hosts (all require 403), and one canonical allowed Host (200). This avoids a Supertest client silently coalescing headers. The test uses a bounded socket timeout and closes its own listener; it does not contact an external host.

Updated `extractHostname` in `server/src/middleware/private-hostname-guard.ts` to scan the original alternating `req.rawHeaders` name/value array, reject missing/malformed arrays and any second case-insensitive Host field, then parse exactly the sole raw authority through the existing strict B1-138/B1-139 parser. It never trusts `X-Forwarded-Host`. No dependencies, allowlist expansion, authentication change or user data. Two preexisting direct middleware mocks now carry explicit rawHeaders for accurate behavior.

## Actual bounded execution (not source-native package qualification)

On isolated model-side Debian Linux Node **22.16.0**, using the real built-in `http` and `net` servers on `127.0.0.1` only:

- **RED**: old first-Host normalized-header behavior returned HTTP **200** for two raw conflicting Host fields (allowed first).
- **GREEN**: equivalent strict rawHeaders admission logic passed **6/6** real TCP/HTTP cases: three duplicate combinations denied, single canonical Host admitted, single blocked Host denied, and missing HTTP/1.1 Host rejected by Node's HTTP parser with **400** (before middleware).
- Only a self-created temporary probe file and ephemeral sockets were used; the probe file was removed. No Desktop Commander, downloads, installs, paid compute or user machine data.

**Important limitations:** The native probe executes source-equivalent raw-header logic, not the checked-in Bostan TypeScript module, full Vitest/Supertest, TypeScript 7, or installed application. The four committed Bostan tests are **AUTHORED BUT UNRUN**. The source-native Linux sandbox four-suite / four rootless bwrap tests and Windows PostgreSQL #234 remain unqualified. This patch does not replace authentication, tenant isolation, or a trusted reverse-proxy contract.

## Frozen review inputs

- Production source Git blob: `78d608eeda697db8a515dad18bfe377cbb01aba0`.
- Test source Git blob: `46b8c5e41a7c0ea2d0f16c4884ca8f17321c8f27`.
- Parent PR #396: https://github.com/TheHalfMoon/Bostan/pull/396.

## Mandatory qualification before release

In an authorized, owner-marked private checkout with preinstalled Node >=24.11 and dependencies, execute the exact `server/src/__tests__/private-hostname-guard.test.ts` Vitest/Supertest suite and strict TypeScript 7 typecheck. Check real reverse-proxy Host forwarding compatibility without treating X-Forwarded-Host as trusted. Continue real Linux rootless bubblewrap, installed Windows/macOS/Linux journeys, PostgreSQL stress/forced-crash cleanup issue #234, Windows compiled authenticated app issue #237, agent tool-effect consent, privacy/tenant security and upstream LICENSE/NOTICE/provenance. **Release NO-GO.**
