# B1-99 — First HTTP stop reason determines the final run verdict

Date: 2026-10-31, Asia/Riyadh. STRICTLY PRIVATE, ZERO-COST, NONPUBLISHING. Exact stacked parent open Draft #353 at ed1912ac7cd5be1ffe567a4435896dc1db829a20.

## Reproduced security and accounting error, RED before source fix

B1-98 correctly routed owner cancellation to the remote HTTP request and protected the initial no-dispatch case. A second race remained in the production HTTP adapter: once its configured deadline fired, the adapter only reported timeout if the remote transport later *rejected specifically with AbortError*. Some custom fetch adapters or raced network stacks may instead resolve a late successful 2xx, a late rejected 429, or reject with a TypeError/provider error. Those paths could incorrectly mark a timed-out request as successful or an ordinary HTTP rejection. In addition, a later owner cancellation after the deadline could overwrite the actual first stop reason and turn the timeout into a cancellation.

Four purely synthetic tests were written before implementation in server/src/adapters/http/execute.test.ts and ran **4/4 RED** on parent source: delayed HTTP 204 after deadline was wrongly accepted as success; delayed HTTP 429 reported ordinary 429 rejection; late non-AbortError returned generic error; owner cancellation second to deadline overwrote timeout. No real tokens/provider, PostgreSQL or customer data were involved.

## Production fix — no changes to network permissions or HTTP request

The adapter's per-invocation AbortController now records a fixed allowlisted first origin: owner cancellation or request deadline. Both listeners are guarded by the controller's aborted flag, so later abort attempts cannot overwrite the first cause. When the remote fetch finishes *either* by resolving headers or throwing an error, the adapter determines final verdict from this recorded first cause **before inspecting a potentially late HTTP status or arbitrary provider error text**. First deadline always returns the same bounded timeout result with exitCode null, errorCode timeout, timedOut true; first owner cancellation returns the existing fixed cancelled result. The pre-dispatch owner cancellation retains executionRecovery bootstrap/providerWorkStarted:false, and a dispatched request is not falsely called pre-dispatch. No AbortSignal.reason, configured endpoint or external error text is copied into the result.

The existing guarded outbound fetch, DNS pin/SSRF protections, request headers/body/auth, actual timeout length, onDispatch, request-signal propagation, unread response body cancellation, listener removal and original success/429 handling when no abort occurred are unchanged.

## Actual Mac source evidence

Authorized Mac Node26, pinned Vitest5 with one worker and capped memory: **100/100 PASS, zero skipped** across 6 HTTP/adapter compatibility suites (HTTP execute 19, real local loopback socket 3, HTTP setup 4, guarded fetch 9, adapter registry 35, API adapter routes 30). Includes the four RED-to-GREEN cases, existing local real HTTP stream/socket closure, prior owner cancellation and timeout semantics. Targeted strict TypeScript7 ES2023/NodeNext noEmit against the modified production HTTP adapter PASS; git diff --check PASS. No external HTTP, real PostgreSQL, provider inference or user data.

## Release remains NO-GO

This closes a distinct HTTP timeout classification race, not end-to-end user-stop proof for all other adapter types, exact Windows packed backend/PG/Chromium, Linux installer, untrusted agent sandbox/effects consent, multi-tenant load or full security/privacy/license/NOTICE/provenance qualification. Keep repository PRIVATE, stacked PR DRAFT; no protected main merge, Actions, publish/deploy/release, paid model, customer data or unrelated host cleanup.

## Native Windows focused QA

On the authorized Windows 11 B144 device, a clean QA checkout fetched the exact verified B1-99 code commit 6ec8d5fcab4c92c30f538a32392862c50d687b8b. Resource gate: 5.53 GiB free RAM and 12.16 GiB free on D:, with no PostgreSQL process. The existing native Node24/Vitest5 toolchain ran four focused suites: HTTP execute (19), real local loopback socket (3), setup checks (4), guarded HTTP fetch (9). All **35/35 PASSED, zero skips, exit 0** in 11.21 seconds. The four previously failing deadline race cases were included. No external HTTP service, model provider, database, installer, browser or customer data was used. This is native Windows source qualification, not packed-app release approval.

## Concurrent B1-99 overlap and dispatch-hook cancellation

Another autonomous workstream opened private Draft PR #354 against the same B1-98 parent while this B1-99 task was active, independently identifying a second narrow HTTP race: an onDispatch callback can **synchronously cancel the owner**, but the adapter previously still entered guardedHttpAdapterFetch with an already-aborted request. This PR now includes an independent RED-before-GREEN regression for that additional case: onDispatch is called exactly once, cancels the caller, the network function MUST NOT be called, the outcome is fixed/redacted cancellation, and no fake pre-dispatch bootstrap accounting is asserted because the dispatch marker already ran.

Production change rechecks the recorded abort cause immediately **after** calling onDispatch and **before** calling guardedHttpAdapterFetch. If cancelled, it returns a fixed cancellation result without a network effect; if the deadline somehow fired first, it returns timeout. This supplements the earlier first-abort-wins work. It does not loosen SSRF/DNS pinning, request authorization or actual network timeouts.

The new regression was RED on the previous candidate (guarded HTTP fetch was called once after synchronous cancellation), then GREEN after this guard. Updated native Mac compatibility **101/101 PASS, zero skips**, six focused HTTP/registry/routes suites with actual loopback socket tests. Targeted strict TS7 noEmit against the modified adapter **PASS**. PR #354 overlaps this functionality; do not merge both unreviewed or claim the two branches are independent release qualifications. Both remain private Drafts, with no protected-main merge or publication.
