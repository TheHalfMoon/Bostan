# B1-98 — Propagate the heartbeat run's cancellation to its HTTP adapter request

Date: 2026-10-31 Asia/Riyadh. STRICT PRIVATE / ZERO COST / NONPUBLISHING. Exact stacked parent Draft #352 HEAD 90ef9c5901a77862ac657b1e7f419148242678b6.

## Verified live-run cancellation defect (RED before implementation)

The production Bostan HTTP adapter had been ignoring AdapterExecutionContext.signal. Unless config.timeoutMs was positive, it never gave the guarded HTTP request any AbortSignal. Even with a configured timeout, its private controller was not connected to the heartbeat owner's stop/cancel signal. A run cancelled before execution could still mark onDispatch and send an HTTP request. A request in flight could remain active after the operator stopped the run. Its own configured timeout could incorrectly be confused with caller cancellation once composed.

Three synthetic regression cases were added BEFORE implementation: previously aborted run must never dispatch or call remote fetch; in-flight cancellation must propagate even without a configured timeout; configured HTTP request timeout must remain a timeout. Parent source yielded **2 RED, 1 PASS**: the already aborted request completed successfully and an in-flight request never saw a caller-linked signal. No real credentials, production provider calls, database or customer workloads were involved.

## Minimal production code changes

In server/src/adapters/http/execute.ts, connect the owner's optional ctx.signal to a dedicated controller that is always passed to guardedHttpAdapterFetch; keep the existing optional HTTP timeout and prevent a later deadline from overwriting an earlier cancellation. Reject a pre-aborted run BEFORE calling onDispatch, with a fixed redacted cancellation outcome and explicit executionRecovery {kind:"bootstrap",providerWorkStarted:false}. This preserves the early no-provider-work admission/accounting proof. During an in-flight request, abort via the shared controller and return an explicit cancelled run outcome (without asserting that provider work never started). Never copy AbortSignal.reason or third-party exception text to returned diagnostics. If a mock or atypical transport resolves just as cancellation occurs, check the owning signal before accepting the HTTP status. Always unregister the owner abort listener and clear the timeout when the operation ends.

Do NOT loosen any network SSRF guard, exact-origin allowlist, pinned DNS, request payload/headers, authentication, body cancellation, 200/429 verdict, provider accounting or app-wide timeout. The handler retains B1-97 unread HTTP response stream cleanup. Only a true configured deadline abort reports errorCode timeout; the operator's cancel reports errorCode cancelled.

## Executed native Mac source and real socket evidence

- Added a real **local loopback HTTP server** regression to server/src/adapters/http/execute.local-socket.test.ts. An actual authorized request arrives and the server intentionally sends no response headers. AbortController is triggered by the synthetic run owner. Bostan returns a fixed cancelled result, and the server independently observes the HTTP connection close. This test restores the pre-test loopback allowlist and closes its own fixture.
- A mocked race test deliberately reports an AbortError only after the configured timeout would have passed: cancellation-first remains cancelled, not incorrectly classified as timeout. External abort reasons are never leaked.
- Native Mac Node 26/Vitest5, one worker, capped heap, **96/96 PASS, 0 skips or failures** across HTTP execute 15, local HTTP socket 3, HTTP setup 4, guarded fetch 9, registry 35 and routes 30. Actual no-external-network local loopback was used, not production PostgreSQL, Chromium or model inference. git diff --check PASS.

## Still release NO-GO

This fixes HTTP adapter lifecycle after the owner cancels the run. It does NOT prove installed Windows packed app startup, real PostgreSQL/Chrome full E2E, system-wide untrusted process sandbox/consent, native Linux release, installers, all-tenant isolation, security/privacy/license/NOTICE/provenance acceptance or autonomous completion. Repo PRIVATE, PR DRAFT, main unchanged, no Actions, publish/deploy, paid inference, customer data or unrelated host cleanup.

## Actual native Windows regression — exact source, not a packed release proof

Windows 11 B144 QA, independently verifying pinned head 7b0ad9ba7e4e2375526c23198f5bb04587176d92, had 5.85GiB available RAM, D: 12.16GiB free and zero PostgreSQL before admitting a focused source test run. Native Windows Node24 with existing Vitest5 dependencies ran the actual test suite over HTTP execution, real local TCP server, HTTP setup and guarded fetch: **31/31 PASS**, 0 skipped, EXIT 0 in 11.24 seconds. The local HTTP test proved the real on-wire socket closed after a synthetic owner cancellation, preserving distinct cancel vs timeout semantics. No downloads, PostgreSQL, Chromium, paid service, real data or installed-product claim.
