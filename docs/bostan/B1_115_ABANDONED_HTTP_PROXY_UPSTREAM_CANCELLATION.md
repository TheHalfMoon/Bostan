# B1-115 — Cancel abandoned sandbox HTTP proxy upstream requests

Date: 2026-10-31 Asia/Riyadh. PRIVATE zero-cost draft engineering only. Stacked on B1-114 private Draft PR #370 head `1a11600b1be78055a4bd97216f91c8670301e184`. No main merges, publish/deploy/releases, GitHub Actions, customer data, paid compute, or changes to origin allowlists and namespace permissions.

## Defect: abandoned origin sockets remain open

The Linux local-process sandbox starts its allowlisted HTTP proxy using `http.createServer`. Once an absolute HTTP URL is authorized, it created an outgoing `http.request(target)` and piped the client's incoming message and origin's response. It did not cancel the outgoing request when the sandboxed agent disconnected **before the origin responded**, or aborted an incomplete upload. An origin holding a response open can therefore retain an unnecessary TCP connection until origin/network timeout, even though there is no client left to receive it. Repeating abandoned requests increases the risk of leaked sockets and wasted resource budgets.

This is a process-availability defect; no real-world attack or user data leakage was observed.

## Implementation in actual private repository

Production change in `packages/adapter-utils/src/local-process-sandbox.ts`, source commit `aacb50faa7e3cc65c03476e427ce207468a3d64b`:
- After `http.request` and before `request.pipe(upstream)`, register `response.once("close", ...)`. If `!response.writableEnded`, destroy the pending upstream request so a disconnected client cannot leave a hung origin connection.
- Register `request.once("close", ...)`. If `!request.complete` (upload incomplete), destroy the pending upstream request.
- **Do not destroy on normal successful requests**: a complete upload and a finished downstream response follow Node's normal completion path.
- Preserve all prior B1-106–111 exact-host/port/IPv6 network authorization, HTTP request and response header filtering, CONNECT handling, and existing no-privilege sandbox semantics; no new dependencies.

New **native Linux source-proxy** regression tests in `packages/adapter-utils/src/local-process-sandbox.test.ts`:
1. Start owner-isolated local origin that intentionally withholds HTTP response; build the *actual Bostan sandbox proxy* with `networkScope="allowlist"`, issue HTTP request over its private Unix proxy socket, confirm origin saw request, client aborts, assert origin-side socket closes within 2 seconds and cleanup all test-owned sockets/proxy/temp workspaces.
2. Repeat with partial `POST` upload and large declared `Content-Length`, confirm origin saw incomplete request, then client aborts, assert origin socket closes within 2 seconds. The expectation is executed in the test body rather than inside an asynchronous origin callback.
These tests were COMMITTED but **not executed by source-native Vitest** in this wave due unavailable connected remote runner.

Key test commits: `01c3860b0e0c8fc32b068cbf3634102e8f2abce3` (GET abort), `1dc626ee8b97dcdb45715c9837f0459c5075c2db` (partial POST abort), `87a5aa18d28651375d0f430cf8e9d058cd45182d` (safe assertion placement). Verified pinned actual Git blobs are production `6ea8184f05437f0391dc6dad2d923c9795c86be5` and tests `b40fe2446a9c391b5fec30529e0be2cc9ea86f48`. B1-112 Linux QA gate updated to BOTH actual blobs, latest pin commit `8ed6c053e89fe1f7d97b327f7adc5e8a8a77daef`; its English documentation updated at `832016c00fb02cadedabf18dce6cc2543b1290c4`.

## Validation actually performed, bounded scope

Native **model-side Debian Linux / Node v22.16.0**, only `127.0.0.1` synthetic HTTP servers and self-owned sockets, using the **same exact forwarding and cancellation logic transcribed from GitHub source**, compared old and patched behavior:

| Scenario | Old behavior | Patched behavior |
| --- | --- | --- |
| Origin intentionally never responds; client aborts GET | Origin TCP connection remains open after abort | Origin TCP connection closes |
| Origin sees incomplete POST body; client aborts mid-upload | Origin TCP connection remains open after abort | Origin TCP connection closes |
| Normal successful HTTP GET | Not separately probed in old form | HTTP 200, exact `origin-ok` body retained |

The model-side 5/5 assertions **PASS**, zero failures. A first single-case RED/GREEN local Node reproduction also confirmed the same dangling-socket issue before patch. Probe code and owned localhost servers were deleted/closed immediately after each run; no user's device was touched. The source and test GitHub blobs/pin lines were verified via private GitHub fetch.

**This is an independent Node reproduction of the actual forwarding logic, not an execution of the full checked-in Bostan TypeScript module or native `bubblewrap`**. Do not claim Vitest source suites, TypeScript7 package typecheck, real Linux namespace, installed Windows/Mac/Linux app, real PostgreSQL stress, agent effect/consent or upstream licensing/NOTICE are qualified.

## Release posture

Full Bostan RELEASE **NO-GO**, all stacked PRs PRIVATE / DRAFT / UNMERGED. NEXT: run B1-114 own synthetic Linux integrity regression script and then B1-112 source-native Linux gate at the B1-115 exact head in a legitimate owner-marked disposable private QA checkout, with existing dependencies and rootless bubblewrap. Preserve failing results; do not force namespace privileges or bypass pins. Afterwards qualify full cross-platform installed product, security and privacy, agent side-effects and consent, PostgreSQL sustained load/crash cleanup, third-party license/NOTICE/provenance. Desktop Commander previously explicitly reported monthly usage exhausted and instructed **do not retry**; no Desktop Commander calls were made this wave.
