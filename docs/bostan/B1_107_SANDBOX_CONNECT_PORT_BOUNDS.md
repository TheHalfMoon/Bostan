# B1-107 — Deny invalid CONNECT ports before unsafe net.connect

Date: 2026-10-31 (Asia/Riyadh). PRIVATE, zero-cost, nonpublishing. Parent private B1-106 Draft #362, exact head `96f42baac532cbafdae3a8a1f84bc8bf0460b1bf`.

## Concrete safety issue

File `packages/adapter-utils/src/local-process-sandbox.ts`, actual `startNetworkAllowlistProxy(...)` CONNECT listener. Previously, it checked `/^\\d+$/` but **not TCP port range** before calling `net.connect(Number(port), hostname)`. For an intentionally host-only allowlist (`127.0.0.1` or another permitted host with `port:null`), requests such as `CONNECT 127.0.0.1:65536 HTTP/1.1` would satisfy the hostname allowlist but cause Node's `net.connect(65536, ...)` to throw a **synchronous** `ERR_SOCKET_BAD_PORT` exception inside the event callback. An unhandled exception could terminate the hosting Node process. This is a defensive process-availability fix, not proof of an observed real attack.

Additional noncanonical CONNECT ports (`0`, leading zeros, sign, text, infinity, huge integer strings) now fail closed before socket creation.

## Implemented source change

New pure exported helper `isValidLocalProcessProxyConnectPort(value: string)` requires **canonical decimal 1..65535** with no sign, leading zeros, whitespace or nonnumeric characters. The existing CONNECT listener checks it **before** the existing exact-host/allowlist authorization and before issuing `net.connect`. Unauthorized or malformed CONNECT requests receive the existing HTTP 403 policy response and no upstream connection. No changes to supported allowlist grammar, bwrap mounts, trusted URLs, proxy permissions, cloud, external services, dependencies or data.

Production code commit: `9ba721fe60354fc938fadb2c0bfc0fe2bfc340cb`; added focused guard tests and Linux-only live proxy test commit `b91e6ee88a0a38fecd7aa8cf5bac297029206773`. Test module `packages/adapter-utils/src/local-process-sandbox.test.ts` now verifies allowed 1/80/443/65535 and denied 0/65536/99999/huge/leading-zero/fractional/sign/invalid strings, and Linux-only probe that sends malformed CONNECT to a genuine local sandbox proxy with an unqualified allowed hostname and then verifies the proxy remains alive. The Linux Vitest integration test is **authored but has NOT been executed**.

## Actual evidence and hard limits

At this moment the connected Mac desktop remote-control monthly quota is exhausted, and no native Bostan-installed Linux sandbox runner or bubblewrap is available through that connector. The private repo cannot be fetched as a full mounted checkout into the model's Linux container. **Do not claim Mac Vitest, adapter-utils tsc, native bwrap or actual repository Linux proxy tests ran for B1-107.**

An independent **native Linux Debian 13 / Node v22.16.0** harness using a literal copy of the B1-107 pure guard and a minimal guarded Node HTTP CONNECT callback was run directly, entirely within a disposable model-side environment. It proved:
1. Bounded port string check works for canonical/inadmissible values: PASS.
2. Unbounded `net.connect(Number("65536"), "127.0.0.1")` throws synchronously with `ERR_SOCKET_BAD_PORT`: PASS.
3. A network-local proxy callback using the same guard returns 403 for `65536`, `99999`, `000443` and `0`, continues responding normally to allowed `443` and refuses an unrelated host after malformed requests: PASS.

This **3/3 PASS standalone Linux reproduction** exercises the relevant guard and Node socket behavior, **NOT** Bostan's actual TypeScript module or native bubblewrap. The isolated harness was deleted immediately; no user's Mac/Windows files or Docker images were created.

## Qualification still required

Run the checked-in Vitest `local-process-sandbox.test.ts`, broader adapter-utils suite, and full TypeScript typecheck on the exact SHA in a real Bostan checkout. Run Linux native integration using actual `startNetworkAllowlistProxy` and `bubblewrap` without privileged or unsafe runtime settings, and test first- and third-party untrusted agent filesystem/network side-effects with explicit consent. All overall Bostan project release gates — actual installed Windows/macOS/Linux app, installers, high load, agent consent, licensing/NOTICE/provenance, privacy/security — remain unqualified. **Keep private Draft/unmerged, full release NO-GO.**
