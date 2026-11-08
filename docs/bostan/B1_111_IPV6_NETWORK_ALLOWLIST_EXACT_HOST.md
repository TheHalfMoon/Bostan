# B1-111 — Exact IPv6 network allowlist matching

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / ZERO-COST / NONPUBLISHING**. Parent: B1-110 private Draft PR #366, exact head `4c05d956f29d21ebe60bc86ffda4e68e16379c47`. No main merge, Actions, publication, deployment, release, npm pack, or paid service.

## Verified defect

The local Linux agent HTTP/CONNECT proxy parses an allowlist origin such as `https://[::1]:443` with WHATWG URL. Node 22 preserves the IPv6 brackets in `URL.hostname` (`[::1]`). The previous `isNetworkTargetAllowed` removed brackets from the *requested* hostname but compared that result against the *unmodified* allowlist hostname. Thus an exact allowlisted IPv6 host was incorrectly denied even with the correct pinned port. This is a functional denial, **not** a network allowlist bypass.

The model-side Node 22 reproduction observed `rule.hostname="[::1]"`, `normalizedTarget="::1"`, and the old exact-match comparison returned false. No customer data or external traffic.

## Code and regression

Test-first commit `4a2e57a8b504c4d93f9a6e571110fb096006b67c` adds a cross-platform IPv6 parser fixture and a Linux-only real loopback-origin + real local sandbox-proxy integration regression. The latter expects HTTP 200 for `[::1]` on the pinned port and 403 for another IPv6 host or port. It constructs the proxy through `buildLocalProcessSandboxSpawnTarget` but does **not** execute bubblewrap; it requires native Linux source testing. The test intentionally does not skip a missing IPv6 loopback capability.

Fix commit `a503046456ae25b575a87e3693a8be61e13e9b1e` introduces `normalizeProxyNetworkHostname` and uses it on **both** sides of the existing exact-host comparison. It removes brackets only when a pair encloses the full hostname, lowercases as before, and preserves the existing exact-port check, including `null` for explicitly unqualified legacy any-port rules. No dependencies, new permissions, or external services.

## Actual bounded validation

- Native model-side Debian Linux Node 22.16: old comparison reproduced the IPv6 mismatch; new comparison passed **8/8** isolated assertions covering bracketed and unbracketed IPv6, wrong IPv6 host, wrong port, IPv4 positive and IPv4 wrong-port negative.
- Extracted comparison code checked with installed TypeScript compiler using `--strict --noEmit`: **PASS**.
- Native model-side IPv6 loopback bind to `::1`: **PASS** (environment capability check, not the actual Bostan proxy test).
- **NOT RUN:** checked-in Bostan Vitest, full adapter-utils TypeScript 7, actual Bostan module execution, Linux bwrap, remote Mac/Windows, installed application or release QA. These remain mandatory gates. Remote Desktop Commander monthly quota is exhausted; no retry/reconnect attempted.
- The only model-side temporary QA directory was removed after the bounded checks; no user machine, retained fixture, or foreign process was touched.

## Open qualification

B1-107 through B1-111 source-native tests and typechecking; real Linux bwrap network proxy, including IPv6/HTTP CONNECT and explicit-port denial; agent side-effect consent, Windows/macOS/Linux installed builds, privacy/security, sustained PostgreSQL stress, and license/NOTICE/provenance remain outstanding. Overall product **RELEASE NO-GO**. Keep all work on private stacked Draft PRs, no main merge or publication.
