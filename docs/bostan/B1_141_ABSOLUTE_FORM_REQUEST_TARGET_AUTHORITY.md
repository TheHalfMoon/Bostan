# B1-141 — Refuse absolute-form HTTP request targets in private mode

Status: **PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO**. Directly stacked on B1-140 PR #397 at exact parent `ead72a47e7db0054ee4203ecbeaff7c86b37c458`. No main merge, Actions, deployment, publication, paid provider, or customer data.

## Finding and boundary

B1-138–B1-140 made the raw `Host` authority fail closed, but the private hostname middleware did not check the HTTP request-target in the request line. Node's real HTTP/1.1 server accepts an absolute-form target such as `GET http://blocked.invalid/api/health HTTP/1.1` with a separate `Host: localhost:3100`; the middleware admitted that allowed Host. A reverse proxy or application URL parser can interpret the request-line authority independently. Bostan is an origin server, **not** a forward proxy, so these two authorities should not coexist at the admission boundary.

This is an HTTP authority ambiguity and defensive private-mode policy defect. It is **not** proof of an authentication bypass, tenant breach, external network access, or a complete SSRF exploit.

## Test-first source patch

Four regression cases were authored first in `server/src/__tests__/private-hostname-guard.test.ts`: three raw HTTP/1.1 absolute-form request targets (forbidden origin over HTTP, allowed origin over HTTP, forbidden origin over HTTPS) must return 400/403, while an ordinary origin-form path with a query remains HTTP 200. The existing real raw-socket test helper now takes a request-target argument. Two direct middleware mocks were given explicit `url` values so they reflect a real Node IncomingMessage.

The production middleware now checks `req.originalUrl ?? req.url` and requires an origin-form target beginning with `/` before admitting the independently validated raw Host. Invalid targets receive a constant 403 message; no attacker-controlled target or Host is reflected. Disabled private mode, the strict Host parser, duplicate Host refusal, existing allowed hosts, and dependencies are unchanged. The guard does not attempt to implement forward-proxy semantics.

## Actually executed isolated native Linux evidence

On a disposable **model-side Debian Linux Node 22.16.0** directory, with real built-in `node:http` and `node:net` loopback sockets only, the **exact B1-140 production TypeScript file** was reconstructed and independently verified by `git hash-object` to match GitHub blob `78d608eeda697db8a515dad18bfe377cbb01aba0`. The Node strip-types runner imported that real module, with lightweight Express-shaped request/response adapters (not the full Express package):

- **RED old source:** 2/5 expectations passed; three absolute-form targets were admitted with HTTP 200 instead of required 403. Ordinary origin-form and query targets passed.
- **GREEN fixed source:** **5/5 PASS, 0 FAIL**. All three absolute-form targets returned 403; ordinary path and query returned 200.
- The fixed source file was independently verified byte-for-byte by Git blob `e878942813c3bcdeea83e7f243ad215ac1fb0a9f` against the private GitHub commit.
- Isolated strict `tsc --noEmit` with TypeScript **5.8.3** and a minimal local Express type stub passed. This is **not** Bostan TypeScript 7 package typechecking.

Only ephemeral owner-created files and loopback sockets were used. No downloads, installs, Desktop Commander calls, user devices, cloud, or customer data. Scratch was removed after verification.

## Frozen review inputs

- Parent Draft PR #397: https://github.com/TheHalfMoon/Bostan/pull/397
- Fixed source blob: `e878942813c3bcdeea83e7f243ad215ac1fb0a9f`
- Authored Bostan regression test blob: `ad26aac0c966e8e8c2a919a68359025ca4b4d493`

## Unqualified gates / release NO-GO

The four **checked-in Vitest/Supertest** regressions are authored but **NOT executed** in the complete Bostan checkout. The isolated Node probe executes the exact middleware but substitutes an Express-shaped adapter and does not validate the actual Express 5 router, installed product, or TypeScript 7. Recheck reverse-proxy compatibility, particularly HTTP/1.1 absolute-form rejection and `OPTIONS *` policy. The private Host middleware currently runs **after** some body parsers; early resource admission remains a separate review item.

Mandatory remaining work: full private Node >=24.11 checkout tests, TypeScript 7, genuine rootless Linux bwrap and four sandbox integration cases, Windows/macOS/Linux installed application journeys, Windows PostgreSQL issue #234 repeated stress and forced-crash cleanup, compiled Windows auth #237, agent side-effect consent, tenant privacy/security, and legally required upstream LICENSE/NOTICE/provenance. **Product release NO-GO.**
