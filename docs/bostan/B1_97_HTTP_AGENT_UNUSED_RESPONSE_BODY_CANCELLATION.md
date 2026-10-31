# B1-97 — HTTP agent releases unused response streams without reading them

Date: 2026-10-31 (Asia/Riyadh). STRICT PRIVATE / ZERO COST / NONPUBLISHING. Stacked parent B1-96 private Draft #351 HEAD ea386dc1adf301b84e8e706bca0aa63032e4c83a.

## Verified resource lifecycle defect (RED first)

The Bostan HTTP agent adapter deliberately uses the HTTP status as its acknowledgement and **does not call response.text(), arrayBuffer(), or read the response body at all**. Prior to B1-97 it also never cancelled the returned ReadableStream. A remote peer may provide an unbounded or long-lived response after sending headers. That unused body can keep an HTTP stream/socket open after the adapter has returned a success or rejected status. This is **not** proof of unbounded response-text buffering; it is an observed **unreleased stream** condition.

Three synthetic no-network regressions were written *before the implementation* into server/src/adapters/http/execute.test.ts: successful 200 with a never-ending unread stream, rejected 429 with an unread stream, and an unused stream whose cancellation rejects. **3/3 were RED**, all because cancel was never invoked (other tests skipped under name filter). No external provider, customer data, real token or database.

## Minimal production fix

In server/src/adapters/http/execute.ts, immediately after guardedHttpAdapterFetch resolves, invoke response.body?.cancel() on the unread response stream **both for success and non-success statuses**. The cancellation promise is not awaited, since remote/untrusted stream cancellation can take indefinitely. Any thrown/rejected cleanup error is suppressed without copying its message or cause to application diagnostics. The original HTTP response status, request method, payload, headers, guarded network egress/DNS pinning, authorization, signal and timeout handling are unchanged.

### Source tests and actual socket closure

- Native Mac Node26/Vitest5 focused HTTP execute/setup/network guard tests: green, including tests for 200, 429, rejected cancellation, and cancellation never settling while a successful HTTP call still finishes.
- Added **real local loopback HTTP server test** in server/src/adapters/http/execute.local-socket.test.ts. Test explicitly allowlists *only* the temporary 127.0.0.1:ephemeral-port origin and restores the former allowlist env in cleanup. The server sends headers and a small body prefix then intentionally never ends the response. The actual full Node HTTP agent makes an authorized local request; the server independently observes connection close after Bostan returns, both for 200 success and 429 rejection: **2/2 PASS**. The test closes only its own local fixture socket in finally. No external network, paid provider, customer information or database.
- Wider compatibility gate native Mac Node26/Vitest5, one worker and capped memory: **91/91 PASS, 0 FAIL/SKIP** across six files: HTTP execute 11, local socket 2, HTTP setup 4, guarded HTTP fetch 9, adapter registry 35, adapter routes 30. git diff --check PASS.

## Limits, still NO-GO

This repairs a distinct HTTP-agent unused-response socket lifecycle, **not** complete streamed-body buffering limits in other request consumers, installed Windows packaging or general SSRF/authorization security. It does not qualify full Linux native runtime, Windows PostgreSQL/Chromium, agent command sandbox/effects consent, sustained high-load resource behavior or legal/license/NOTICE/provenance audits. Keep Bostan PRIVATE, Draft, zero-cost, without main merge, release, deployment, Actions, customer data or paid models.
