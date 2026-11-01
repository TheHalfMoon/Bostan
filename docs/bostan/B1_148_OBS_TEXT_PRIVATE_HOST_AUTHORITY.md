# B1-148 — Reject HTTP obs-text in private Host authority

**Status:** PRIVATE DRAFT / UNMERGED / RELEASE NO-GO. Stacked on B1-147 Draft PR #404, parent commit `53d3f32178e755918f43cc18f29b24157b1052b7`.

## Security defect and concrete reproduction

The prior `parsePrivateHostHeader` first called `value.trim()` and only then rejected ASCII controls. Node v22.16.0's HTTP parser preserves the Latin-1 non-breaking space byte `0xA0` in `req.rawHeaders` and `req.headers.host`. JavaScript `String.trim()` removes that character. Consequently, a raw `Host: <0xA0>localhost:3100` or `Host: localhost:3100<0xA0>` was silently transformed into the privileged `localhost` authority. The same parser is used by private HTTP and WebSocket upgrade admission.

This is an authority canonicalization defect. It does not by itself prove a remotely exploitable authentication bypass or access to real data. It undermines the private-mode rule that untrusted, noncanonical Host values must fail closed.

## Test-first change

1. Add two regression cases in `server/src/__tests__/private-hostname-guard.test.ts` for leading and trailing `\\u00a0` in Host, asserting both parser rejection and HTTP 403. The raw TCP fixture now writes Latin-1 bytes, not UTF-8, so Node receives a single `0xA0` obs-text byte.
2. Add a private WebSocket Host admission regression for leading NBSP and an Origin regression for trailing NBSP.
3. Update `server/src/middleware/private-hostname-guard.ts` to refuse all characters outside printable ASCII `0x21..0x7e` **before** any normalization. Host authorities use ASCII on the wire; internationalized domain names must use ASCII A-labels. Remove the pre-validation `trim()` rather than silently rewriting an untrusted authority.
4. Preserve normal `localhost`, canonical IPv4 and bracketed IPv6, configured hostnames, existing raw duplicate-Host rejection, and public-mode behavior.

## Actually executed

- **Native Debian Linux Node v22.16.0 raw HTTP probe:** a real `node:net` TCP client sent Latin-1 `0xA0` bytes to a local `node:http` server. The server's raw headers preserved NBSP. With the prior parser-equivalent implementation, both NBSP variants returned **HTTP 200**; with the patched parser-equivalent implementation, both returned **HTTP 403**. Canonical `localhost:3100` remained **HTTP 200** in both versions (3 before/after comparisons).
- **Native Node v22.16.0 raw WebSocket upgrade probe:** a request with `0xA0` before `localhost` reached the server's actual `upgrade` callback and produced a test-only HTTP 101 response. This confirms that Node does not inherently filter the malformed Host at its upgrade boundary. The probe did not run the complete Bostan upgrade listeners.
- Read back the exact updated GitHub source and regression test content. Parent parser blob: `ca1b96cb2f5fee7afce7ef8bf4989c4f37b68851`; fixed parser blob: `6b16fb7688617603400ed02448ee5a1a09aedc0e`.
- Only dedicated temporary local probe files were created and removed. No Bostan checkout, customer data, paid service, deployment, or GitHub Actions were used.

## Not executed / limitations

The newly authored four Vitest regression cases and the rest of `server/src/__tests__/private-hostname-guard.test.ts` were **not** executed in the full private Bostan checkout. The native probes used source-equivalent isolated parser logic, not the full checked-in TypeScript module with Express, Supertest and installed dependencies. Node >=24.11, TypeScript 7, four source-native Linux sandbox Vitest suites, four genuine rootless bwrap cases, browser/agent/tenant privacy qualification, installed Windows/macOS/Linux, PostgreSQL forced-crash issue #234, authenticated Windows issue #237 and legal LICENSE/NOTICE/provenance review remain outstanding.

**RELEASE NO-GO.** Do not merge `main`, publish docs/npm/packages, deploy, enable Actions, use paid providers/customer data, delete foreign files/processes or remove legally required attributions.
