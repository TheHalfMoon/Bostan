# B1-130 — Close downstream HTTP clients after an allowed origin aborts its response

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / ZERO COST / DRAFT UNMERGED / RELEASE NO-GO.**
Direct parent private Draft B1-129 PR #386 exact head `16b2455de067fb4352e42266145a6bb69126a1c6`.

## Reproduced proxy liveness failure

B1-129 protected the HTTP **CONNECT** branches against client socket errors. The separate ordinary allowlisted HTTP proxy path inside `startNetworkAllowlistProxy()` has a distinct edge case: once `http.ClientRequest` receives successful upstream headers, a server can abort the **`IncomingMessage` response** while streaming a body. The `ClientRequest.on("error")` callback already present does not ensure errors on that later `IncomingMessage` terminate the downstream `http.ServerResponse`. In a bounded local reproduction, the downstream client received `7` bytes of a declared 5,000-byte body and then waited indefinitely instead of getting a connection-close signal.

## Actual bounded native Node networking: red then green

Executed on model-side native Debian Linux **Node v22.16.0**, loopback `127.0.0.1` only, no GitHub Actions, downloads, user device, private data or paid compute. The standalone probe implemented the same Bostan `http.request(target, options, upstreamResponse => { response.writeHead(...); upstreamResponse.pipe(response) })` handler and existing downstream close / client request-body close handlers:

- **RED, unchanged handler equivalent:** the allowed local HTTP origin sends headers with `Content-Length: 5000`, writes the first seven body bytes, and destroys its TCP socket after 20ms. Instrumentation showed `upstreamResponse aborted` and `upstreamResponse close`, but the downstream HTTP client did not receive `close` or an error. The probe was stopped by `timeout 4s` with **exit 124**. This is a proved client-liveness failure, **not** proof of process crash or sandbox escape.
- **GREEN, same handler with `upstreamResponse.on("error", () => response.destroy())`:** the downstream client received `ECONNRESET` and closed promptly, allowing a new request on the same proxy to finish successfully with output `survived fixed`, **exit 0**. The probe observed `origin response error ECONNRESET`.
- **GREEN repeatability:** this exact fixed equivalent HTTP proxy/origin probe was executed **12/12 independent times PASS**, each independently aborting the origin mid-response, verifying the client closes, and serving a new HTTP request afterward. All execution and logs lived only under temporary `/tmp/bostan_b131_*` files, which were removed after the tests.

**Strict evidence scope:** These are real Node network operations exercising the same proxy code pattern; they are not full checked-in Bostan source-native Vitest or a real bubblewrap namespace. The new Bostan integration regression below was authored and pinned but not executed in the full private checkout during this wave.

## Checked-in changes

**Test first:** `packages/adapter-utils/src/local-process-sandbox.test.ts`, commit `79ee973f6a0f8eac780066c68b9141fe2808538f`. New Linux-only `it.runIf` case: create localhost HTTP origin with `/aborted` response (declared `Content-Length: 4096`, writes `partial`, aborts socket after 20ms); create real Bostan sandbox proxy using a test-owned workspace, `networkScope: "allowlist"`, exactly that localhost origin port and its Unix proxy socket; require downstream reply `close` within 2s rather than hanging with an incomplete body, then send a healthy request and require `HTTP 200 / healthy`. Cleanup closes origin/proxy and only owned synthetic files. No actual bwrap subprocess is required for this proxy-lifecycle test, but it runs as part of the pinned source-native Vitest suite which remains pending.

**Minimal production fix:** `packages/adapter-utils/src/local-process-sandbox.ts`, commit `2b45d1c7d36019bee15e9cb23e9848f4532e8bbd`. Register `upstreamResponse.on("error", () => response.destroy())` *before* `upstreamResponse.pipe(response)`, retaining existing downstream/origin connection-abort handlers. This adds no new permissions, hostname acceptance, user data exposure, dependency, external request or release action.

**Frozen reviewed source Git blobs:**
- `packages/adapter-utils/src/local-process-sandbox.ts` = `d4e4edba99cb0ec5db5ffcff47c0eedc404470c3`.
- `packages/adapter-utils/src/local-process-sandbox.test.ts` = `f04ef1809e58626aa9f9a34da49b2ba7d5c5af1b`.

Both Git blob identities were independently re-fetched from the private candidate and frozen into the fail-closed Linux QA gate `scripts/bostan-private-linux-sandbox-gate.sh`, commit `f14bd36cd5b8d0fc79270e396c209f78b7fdac72`. Historical gate documentation `docs/bostan/B1_112_LINUX_SANDBOX_SOURCE_NATIVE_GATE.md` updated at commit `5a117cbddd28ab8ddc4ea2d4897a944b76c27df5`. The three other pinned Vitest files and JSON-audit identity requirements were not changed.

## Remaining mandatory QA and release blockers

The prior exact original four QA-tool scripts have separately **27/27 PASS** (11 JSON auditor Node tests and 16 synthetic Git admission Bash checks, on the exact GitHub bytes), but the complete Bostan production-source `bash scripts/bostan-private-linux-sandbox-gate.sh --run` with four Vitest suites, the actual rootless bubblewrap integration cases and adapter-utils TypeScript7 **has not run**. The model container has Node22 rather than required Node>=24.11 and lacks preinstalled Vitest5, TypeScript7, bwrap and the complete owner-marked private repo checkout. No test or marker was waived.

The product-level installed Windows/macOS/Linux acceptance, governed agent side effects/consent, repeated native Windows PostgreSQL multi-suite sustained stress and forced-crash teardown (issue #234), tenant/privacy/security and third-party LICENSE/NOTICE/provenance verification remain release blockers. Remote Desktop Commander had previously explicitly reached monthly quota and instructed DO NOT RETRY; it was not invoked.

Use an authorized PRIVATE disposable native Linux QA worktree at the exact Draft HEAD to run all source-native suites/4 genuine bwrap cases/TS7, preserve real logs and refuse skip. **Overall Bostan release NO-GO**. Repo PRIVATE, all PRs Draft unmerged, main unchanged, GitHub Actions disabled, no deploy/publish/release/npm pack, paid providers, customer data, unowned cleanup or required upstream notice removal.
