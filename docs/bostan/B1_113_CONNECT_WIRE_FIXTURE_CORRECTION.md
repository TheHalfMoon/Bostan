# B1-113 — Repair malformed HTTP CONNECT wire fixtures before Linux qualification

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, DRAFT, zero-cost, unmerged, no publishing/deploy/release.** Parent B1-112 private Draft #368 exact head `48e1f4727fd686881cc5de6000931ae34f1b48a8`.

## Real test defect identified in committed source

`packages/adapter-utils/src/local-process-sandbox.test.ts` at parent #368 used **literal backslash characters** `\\r\\n` in two new Linux-only CONNECT test frames (formerly around lines 138 and 242), instead of HTTP CRLF delimiter escapes `\r\n`. Those frames emitted the bytes `0x5c 0x72 0x5c 0x6e` instead of `0x0d 0x0a`; they never formed a syntactically valid HTTP/1.1 CONNECT request. Therefore the Linux tests for B1-106 pinned-default-port denial and B1-107 invalid-port process availability could fail or hang before exercising their intended authorization rule. An older CONNECT test in the same file already used proper escape sequences. This is a test correctness issue, not an observed real-world sandbox bypass.

## Source repair

**Tests commit `2a09f2cd86ca314744a14f7b301087f93d8fcf8b`**:

- One shared test-only `connectFixtureRequest(authority)` builds three real HTTP/1.1 `\r\n` delimiters and terminates headers with `\r\n\r\n`.
- Both broken tests and the older correct test send the common frame rather than maintaining divergent raw string literals.
- Cross-platform unit check asserts expected string, absence of literal backslash-r/backslash-n, and trailing byte sequence exactly `0d 0a 0d 0a`.
- No production code, network policy, sandbox privileges, dependencies, user data or release configuration changed.

**Gate pin commit `60ba347baf7aa4349486363bcafa6f31afc4a63c`** updates `scripts/bostan-private-linux-sandbox-gate.sh` to the actual corrected test Git blob `fa96f8055107500cdc8b608740ac08a523637b3b`, retaining pinned production source blob `200da80d364053aa984d83d66864b02e99258f79`. Old test pin was `c6194975c177986d80a3a4add92bd479a8bbdcf0`, so B1-112 previously would intentionally refuse the corrected checkout until updated. Evidence in `docs/bostan/B1_112_LINUX_SANDBOX_SOURCE_NATIVE_GATE.md` aligned at commit `e41e488724cfe7839d1c4603342d26ce89bb396c`.

## What was actually tested

1. **Exact GitHub file inspection** before patch found two lines containing doubled backslash CRLF sequences, whereas the older original request line used single escaped CRLF. After patch, retrieved full test file at commit `2a09f2...` had zero occurrences of doubled escapes, three usages of the single `connectFixtureRequest`, and the new byte-level test. Actual blob ID `fa96f8055107500cdc8b608740ac08a523637b3b` was used to repin the Linux gate.
2. **Actual isolated native Linux Node v22.16 HTTP server and TCP socket reproduction**, using loopback only and synthetic data: old literal-backslash CONNECT frame had **zero proper CRLF separators** and triggered HTTP parse error/no `connect` callback. Correctly framed request had **three proper CRLF separators**, reached the genuine Node `http.Server` `connect` listener once and received an HTTP 403 response. This demonstrates that malformed fixture bytes invalidated the intended test.
3. Independent source-equivalent fixture constructor check asserted the exact trailing CRLFCRLF bytes and then drove a native loopback Node HTTP CONNECT handler that returned 403. Both reported PASS. No external network, paid services, customer data or Mac/Windows files were used; model-side temporary scripts were removed.

**Caveats:** These are standalone Node protocol repros, not execution of the actual private Bostan checked-in Vitest suite, package TS7, bubblewrap, installer, or full B1-112 Linux gate. Desktop Commander previously indicated monthly quota exhausted and explicitly instructed not to retry/reconnect; no DC request made. Do not label B1-113 platform-qualified.

## Mandatory next stage

Run `bash scripts/bostan-private-linux-sandbox-gate.sh --run` in a user-owned disposable private checkout on native Linux with installed requirements and exact B1-113 source/test pin, without privileged settings. Record actual source-native results and failures at the exact SHA. Then still qualify entire sandbox runtime, installed Windows/macOS/Linux apps, real PostgreSQL sustained stress and crash hygiene, agent consent/effects, privacy/tenant isolation, and upstream third-party licenses/NOTICE/provenance.

**Bostan overall NO-GO**, all PRs private Draft/unmerged, no main merge, Actions enablement, release, publication, deployment, npm pack or paid compute.
