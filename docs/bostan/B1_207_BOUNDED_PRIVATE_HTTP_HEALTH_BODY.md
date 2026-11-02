# B1-207 — bounded private Windows HTTP health response body

**Scope:** PRIVATE stacked Draft only; **RELEASE NO-GO**. Parent #463 exact HEAD `330cbe35ae19de7cc50f8e76cfc44e095b4ab56a`.

## Source-backed issue

The native Windows HTTP QA runner releases its temporary loopback port before starting the server, and probes `/api/health` **before** the two-snapshot owned-listener PID check. The existing probe called `response.json()`, which buffers an unbounded body from whichever localhost process answers during that gap. A foreign or malformed listener can therefore return a large but otherwise valid authenticated/private/pending JSON body and exhaust QA memory before PID proof. This is a synthetic source-level risk reproduction, not an observed user-device incident.

## Repair

Read the Fetch body through its byte stream and enforce **4096 decoded bytes maximum** before UTF-8 decoding or JSON parsing. Refuse oversized `Content-Length` immediately, but do not trust it: enforce the byte limit on actual chunks, including chunked responses. Refuse missing/non-stream bodies, invalid UTF-8, empty bodies and invalid JSON. Cancel the reader without awaiting cancellation on failure or completion. Preserve the existing single request timer, monotonic deadline, child-exit checks, loopback-only URL, and exact health-state acceptance. No PostgreSQL lifecycle, process termination, or user files changed.

## Actual isolated Linux Node 22.16.0 evidence

- Original source blob `9d393f1efbfaffe6e5c648b6290f2e5ef6971f80` and original test blob `cd7c1b874ba21ca008f3224e7f2726919e5ba087`: **13/13 original tests PASS**.
- Test-first new regressions on the original implementation: **13 PASS / 4 expected RED**, exit 1. Oversized normal JSON, oversized chunked JSON, oversized declared length, and a non-stream `json()` mock were all accepted incorrectly.
- Repaired source blob `a08eb3683a889f01c50a691831330a80f56b25ba`, test blob `7630ac46e1831a936efed7bdf1c2c392ca1791f2`, both exactly hash-matched against the locally executed files: **18/18 PASS, zero skipped, exit 0**. Includes a positive real HTTP body within the cap, late deadline, child exit, stalled fetch/body and existing health-state refusals. `node --check` passes.
- Reproduce on an isolated Node 22 checkout: `node --test scripts/bostan-private-windows-health-wait.test.mjs`. No external network, cloud, paid service, real PostgreSQL, Chromium or customer data.

## Limits / remaining gates

This is a byte-buffer bound at the application stream consumer, not an atomic listener lease or kernel attestation; a single Fetch chunk may be allocated by the runtime before the consumer rejects it. The two-snapshot owned PID check remains mandatory. Native Windows PowerShell/CIM, real PG18.1 forced-crash zero-orphan #234, fresh installed compiled authenticated HTTP + real Chromium #237, full TS7/Vitest and installed Windows/macOS/Linux E2E remain **unqualified**. No main merge, Actions, release, publication, deployment, remote device quota bypass, B212 retained fixture access, foreign cleanup, or donor license/NOTICE change.
