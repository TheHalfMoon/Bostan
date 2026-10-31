# B1-110 — Prevent hop-by-hop header/secret forwarding across the local agent HTTP proxy

Date: 2026-10-31 Asia/Riyadh. PRIVATE, zero-cost, NONPUBLISHING. Parent B1-109 private Draft PR #365 head `6411b25cf97a58bc64d9318baa84a815865f3dff`. No main merge, GitHub Actions, release or deploy.

## Product security problem

After B1-109 removed `Proxy-Authorization` and `Proxy-Connection` from request headers, `startNetworkAllowlistProxy` still copied arbitrary HTTP headers directly to the next hop. Per RFC 9110, `Connection` nominates additional *hop-by-hop* headers. A client could send `Connection: keep-alive, X-Bostan-Hop-Token` and `X-Bostan-Hop-Token: [local secret]`: the header would be transmitted to any allowed origin, although it was scoped to the client-proxy link. The reverse direction used `response.writeHead(..., upstreamResponse.headers)`, forwarding origin's hop-only fields and any `Connection`-nominated private header to the proxy client.

This is a *header-boundary issue*. It is not evidence that external credentials were actually stolen, nor does it replace the underlying network allowlist/sandbox.

## Source fix

Initial test-first commit `8acd886a7f986f9fd0d1d39a157e32350e398ae9`: three tests added in `packages/adapter-utils/src/local-process-sandbox.test.ts` — pure outgoing-request filtering; pure upstream-response filtering; and a Linux-only actual allowlisted local proxy/origin integration checking that dynamic Connection-nominated local tokens never traverse either direction.

Source implementation commit `ab9c5215419793cc3f5bfe2afd464ab4c5213003` in `packages/adapter-utils/src/local-process-sandbox.ts`:
- Added `filterLocalProcessProxyHopByHopHeaders(incoming)` to shallow-clone and exclude standard hop-only names: `Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding`, and `Upgrade`.
- Parse case-insensitive comma-separated `Connection` tokens and exclude nominated fields from the next hop.
- `buildLocalProcessProxyOriginHeaders` calls the filtering helper, then **restores the allowed destination Host** and preserves ordinary origin `Authorization` and unrelated headers.
- `response.writeHead` uses the same filter on `upstreamResponse.headers`. Node's HTTP transport independently sets correct framing for the proxy's new response hop.
- No changes to allowed hosts/ports, tunnel policy, mounted filesystem, agent permission model, dependencies, or customer data. The original input header objects are not mutated.

## Actual bounded verification (NOT full repository QA)

Independent native Linux Node v22.16 test with **synthetic tokens** and only local 127.0.0.1 servers:
1. **Old helper RED:** original B1-109 filtering left `Connection`, `TE`, and a `Connection`-nominated `X-Bostan-Hop-Token` untouched. A local actual HTTP origin received the synthetic hop secret. Both expected red assertions observed, test exited zero as a reproduction.
2. **Exact B1-110 newly committed TypeScript helpers** from the GitHub source were copied to a short-lived model-side test file and run via Node's `--experimental-strip-types`. Pure helper check **PASS**, and actual HTTP request through a minimal localhost proxy to a localhost origin **PASS**, with `X-Bostan-Hop-Token` absent upstream, `X-Origin-Private` absent downstream, origin `Authorization` and ordinary metadata retained, final request status 200.
3. **Extracted helper TypeScript 5.8.3 strict `--noEmit` check PASS** (Node type declarations). This is limited to the two helpers, not the entire `adapter-utils` package, and is NOT a TypeScript 7 or Vitest result.

Ephemeral model-side test files were deleted. No remote desktop worktree, Mac/Windows files, Docker images, external network, user secrets, or paid services were involved.

## Qualification still open

The added **checked-in Vitest regression suite was NOT executed**; native Linux `bubblewrap`/actual Bostan proxy path, full package TypeScript 7, Windows/macOS installed product, installers, realistic agent side-effect approvals, tenant isolation load and license/NOTICE/provenance gates are also not qualified. Remote Desktop Commander monthly quota exhausted and explicitly refused calls; do **not** retry or bypass it. Retained B144/B191 Windows failed-attempt fixtures untouched. This code requires source-native tests and full Linux runtime before any release decision.

Full Bostan release **NO-GO**. Keep PRIVATE Draft unmerged, Actions disabled, no publication/deployment/npm pack, paid cloud, customer data, deletion of other users' files or required third-party notices.
