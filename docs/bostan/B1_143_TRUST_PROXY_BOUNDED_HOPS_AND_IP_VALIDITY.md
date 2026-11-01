# B1-143 — Bound trusted proxy hops and validate IP subnet tokens

Status: **PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO**. Based on B1-142 Draft PR #399 at `c01e9349cd425e8a1e1f2214cb42a7f425bc54be`. This change does not enable TRUST_PROXY, expand its trusted sources, modify authentication, merge main, run Actions, publish or deploy.

## Source-backed defect

At the pinned parent, `server/src/middleware/trust-proxy.ts` accepted any decimal string matching `/^[1-9]\\d*$/` and returned `Number(value)`. A very long integer becomes `Infinity`, and a finite oversized hop count effectively trusts every forwarded hop in an ordinary request chain. This is a **configuration trust-boundary hazard**, not proof of a live external exploit. The same parser admitted invalid IP tokens (for example `999.999.999.999` and `:::`) because its regexes checked only character patterns, not IP validity.

## Test-first repair

- Added Vitest regression cases for 33/1000 hops, unsafe or overflowing integers, malformed IPv4/IPv6 tokens (including mixed allow lists), and valid bounded hops and CIDRs.
- Reject numeric hop counts outside **1..32**, including non-safe or infinite JavaScript numbers, with a fixed-size error message for oversized numeric values.
- Preserve the previous accepted CIDR character/prefix grammar, but require `node:net.isIP` to validate the address portion. No third-party dependency or new allowed token form.
- Preserve explicit `true` and valid named subnets, existing disabled behavior, and normal `TRUST_PROXY=1` / `2` configurations. Operators with intentionally more than 32 hops must review and explicitly configure trusted proxy subnets; this is a deliberate fail-closed compatibility change.

## Actual execution and limits

**Actually executed** on isolated model-side Debian Linux Node 22.16.0, using a source-equivalent standalone Node built-in assert harness and the real `node:net.isIP` implementation: **17/17 PASS**. The old parser admitted `Infinity`, hop count 33, `999.999.999.999`, and `:::`; the repaired equivalent rejected 4 unsafe hop values and 6 malformed IP configurations while retaining 3 valid configurations. The harness used stdin and created no persistent files.

**NOT executed**: checked-in `server/src/__tests__/trust-proxy.test.ts` under Bostan Vitest/Supertest, complete Express trust-proxy request forwarding, TypeScript 7, installed Windows/macOS/Linux application, or native rootless Bubblewrap. No claim of release qualification. Run those tests in an authorized owner-marked private checkout with preinstalled dependencies before any integration.

## Outstanding gates

B1-138..B1-142 private Host and app admission Vitest, the four Linux sandbox suites and four real bwrap integration cases, full TypeScript7, Windows PostgreSQL #234 stress/crash teardown, compiled authenticated Windows #237, agent tool-effect consent, tenant/privacy/security, and upstream LICENSE/NOTICE/provenance remain open. **Release NO-GO**.
