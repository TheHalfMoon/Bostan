# B1-99 — Fail closed on HTTP transport responses arriving after deadline

Date: 2026-10-31 Asia/Riyadh. STRICT PRIVATE / ZERO COST / NONPUBLISHING. Exact parent open Draft #353 `ed1912ac7cd5be1ffe567a4435896dc1db829a20` (`work/b1-98-http-agent-run-cancellation-propagation`). No merge to main, Actions, release, deployment, npm packaging, external provider or customer data.

## Actual RED-before-GREEN evidence

The B1-98 HTTP adapter correctly forwarded owner cancellation and configured deadline to a transport AbortSignal, but relied on the transport to honor it. A noncompliant/mock transport could resolve with HTTP 204 after the deadline had already fired; the adapter then returned `exitCode:0` and `timedOut:false`. A transport that rejected with a generic error after the deadline could be classified as an unrelated invocation failure rather than a timeout. A synchronous `onDispatch` callback could cancel the owner, but the adapter still called guardedHttpAdapterFetch with an already-aborted signal. These cases are bounded, synthetic and do not call external network services.

Three regression tests were added to `server/src/adapters/http/execute.test.ts` **before** changing production code. Against the exact parent, actual Mac Node 26/Vitest 5 yielded **15 PASS / 3 FAIL**, with failures independently proving late-204 false success, late-error wrong verdict and a request attempted after synchronous cancellation.

## Narrow production fix

- Reuse a fixed safe timeout result when the configured deadline has fired, both when the transport eventually resolves and when it eventually rejects (even with a non-AbortError). The transport's untrusted error text is not persisted.
- Recheck the owning run's cancellation immediately after `onDispatch` and before invoking the guarded fetch. Do not claim pre-dispatch `executionRecovery` after the dispatch hook has already fired.
- Preserve cancellation-first precedence: if the owner cancelled before the deadline, the timer does not relabel the cancellation. If the deadline fired first, a later owner cancellation does not override the deadline verdict.
- Preserve the existing DNS pin/SSRF guard, endpoint allowlist, HTTP body cancellation, timeout setting, request payload, headers, authentication, dispatch semantics and redacted diagnostics. No new dependency or license/NOTICE change.

## Executed regression evidence

On the native Mac source checkout with a 1024 MiB Node heap and one Vitest worker, all **103/103 tests PASS**, zero failures and zero skips across seven suites: HTTP execute 18 (including the three RED-before-GREEN regressions), real loopback socket 3, HTTP setup 4, guarded remote fetch 9, adapter registry 35, lightweight routes 4 and adapter routes 30. The first six suites ran together **73/73 PASS** and the seventh separately **30/30 PASS**. `git diff --check` PASS. No real PostgreSQL, Chromium, Windows compiled app, Linux or external provider was exercised in this B1-99 run. The parent B1-98 full server TypeScript semantic gate remains previously proven for parent source only; B1-99 does **not** claim a fresh full semantic typecheck.

## Remaining limits and NO-GO

This fix prevents **false success after a deadline**, but does not forcibly settle a third-party transport that ignores AbortSignal and never returns. Real fetch cancellation is covered by the parent B1-98 local socket test; this change does not establish end-to-end installed Windows packed app startup, real multi-suite PostgreSQL cleanup, full Windows/Linux/macOS packaging, Chromium, untrusted process sandbox/effects consent, privacy/security/licensing/provenance acceptance or release readiness. The retained B135 fixtures and all unrelated processes must remain untouched. Keep PRIVATE / stacked DRAFT, no main merge, no Actions, no publish/deploy, no paid compute/models and no customer data.
