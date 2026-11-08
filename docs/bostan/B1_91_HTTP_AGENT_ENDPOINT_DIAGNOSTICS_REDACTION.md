# B1-91 — Prevent HTTP agent endpoint credentials from entering diagnostics

Date: 2026-10-31. Strict PRIVATE / ZERO-COST / NONPUBLISHING. Exact stacked parent private Draft #345 `826b1634222d1806d018445732e213058383ab9c`.

## Source-level security defect, reproduced RED

The **production** HTTP agent adapter included raw operator-supplied endpoint URLs in persisted execution summaries (`HTTP METHOD URL`) and timeout error messages. Its setup/test-environment path also emitted full URLs (including `username:password@`, paths, query-string tokens and fragments), invalid URL input, arbitrary configured method text and raw external probe error messages. These messages may be persisted in run and setup diagnostic surfaces and are unsafe when signed URLs, credentials, tenant hostnames or third-party error text are present.

Added focused regression tests **before code changes**, using purely synthetic strings such as `PRIVATE_PASSWORD`, `PRIVATE_QUERY` and `PRIVATE_SECRET`, with a mocked transport. **5 new tests were RED** on the original stacked parent; the 3 preexisting execution tests passed. No network requests, database or customer data were used for the reproduction.

## Narrow production fix

Added `server/src/adapters/http/safe-diagnostics.ts`, returning a **closed list of safe HTTP method labels** (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, otherwise `custom`) and a **closed set of known network-error codes**, otherwise `unclassified`. Unexpected error getters/Proxy traps fail closed to `unclassified`. It never copies the original external error as a cause.

Updated `server/src/adapters/http/execute.ts`:
- The actual configured URL, headers, request method, JSON payload, network guard and on-dispatch behavior are **unchanged**.
- Persisted success summary is now `HTTP <safe-method> request completed` — no URL.
- Timeout error is `HTTP <safe-method> request timed out after <configured-timeout>ms` — no URL.
- HTTP non-2xx status continues to fail with its bounded numeric status, but never includes a raw URL/body.
- Other thrown transport/provider errors are converted to a bounded `HTTP adapter request failed (<allowlisted-code>)`, never copying the remote error message or `cause` into persisted diagnostics.

Updated `server/src/adapters/http/test.ts`:
- A malformed URL, unsupported scheme and successful endpoint configuration are reported with fixed text, not the untrusted URL.
- Configured method info uses the same safe method label.
- An external HEAD probe error contains only the fixed `HTTP adapter endpoint probe failed (<allowlisted-code>)` text; an untrusted exception message never escapes.

This does **not** claim outbound untrusted HTTP calls are sandboxed or that a configured URL is safe by itself. The existing guarded HTTP transport's allowlist, DNS resolution pinning, link-local denial, redirects policy, and authorization requirements remain the enforcement points. No production routes, PostgreSQL schema or agent permissions were changed.

## Objective execution

Authorized Mac with Node 26 and existing pinned Vitest 5 dependencies; focused run with a 1024 MiB heap and one worker, **20/20 PASS** across:
- HTTP adapter execution and timeout/error redaction tests;
- new setup/connection diagnostics and malicious error getter tests;
- existing remote HTTP guard tests (private-address denial and exact-origin restrictions).

Targeted TypeScript 7 strict `--noEmit --ignoreConfig` on the modified adapter code **EXIT 0**. `git diff --check` PASS. No customer data, paid provider/model, network calls, runtime package install, publication or host cleanup.

## Still unqualified

This resolves only the identified HTTP agent diagnostic leakage. A full adversarial agent effect sandbox/consent review, permission-bounded tool execution, cross-company abuse E2E, pinned Windows packed runtime HTTP startup, native Windows/Linux installer qualification, PostgreSQL multi-suite ownership, security/privacy/license/NOTICE/provenance audit and product-wide acceptance remain release **NO-GO**. The real Windows device had under the established resource admission on C:/RAM during this round; no heavy live Windows PostgreSQL/Chromium E2E was executed. Keep repo PRIVATE, stacked PR DRAFT, do not merge protected main, publish/deploy/release/npm pack, enable Actions, use customer data or paid inference.

## Broader adapter compatibility regression

After the initial exact-head commit `69fb632e15ac6d48f2e7942f925c72fa42c62da8`, also ran **108/108 PASS** native Mac Node26 / Vitest5 tests, with one worker and 1536MiB V8 memory cap, across `server/src/__tests__/adapter-registry.test.ts` (33 cases), `adapter-routes.test.ts` (30), and `built-in-agents.test.ts` (45). This validates route setup and adapter discovery/overrides compatibility after the HTTP adapter diagnostic wording change. These are source integration tests using local test fixtures, not complete Windows/Linux real installed-product E2E or adversarial sandbox qualification. The tracked source checkout remained clean and no new package installation was performed.
