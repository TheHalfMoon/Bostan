# B1-139 — Reject noncanonical numeric IPv4 Host authorities

Status: PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO. Parent: B1-138 Draft PR #395, exact initial head `d5bf1815afeaae2c4ef27508f6c925e7f4de510c`. No main merge, Actions, publication, deployment, customer data or paid services.

## Finding

B1-138 correctly stopped untrusted X-Forwarded-Host and obvious malformed Host values, but the remaining WHATWG URL normalization accepted legacy numeric IPv4 authority spellings as canonical loopback. The parsed `hostname` became `127.0.0.1` for each of:

- `127.1:3100`
- `0177.0.0.1:3100`
- `0x7f000001:3100`
- `2130706433:3100`
- `127.000.000.001:3100`
- `127.0.0.1.:3100`

These noncanonical spellings passed the private-mode loopback allow decision. This is a Host-authority canonicalization flaw, **not** proof of network perimeter bypass: a client can also send a canonical `Host: localhost`, and the guard is not an authentication or network isolation mechanism.

## Change

Test-first commit `855265f34f8a39a678f2c791a7529fad25e7194b` adds six source-native Vitest/Supertest denial cases and a positive canonical dotted-decimal IPv4 loopback case to `server/src/__tests__/private-hostname-guard.test.ts`.

Fix commit `32f2b82eacdc6b6f680f7e5d8356f0099eaba312` requires an unbracketed Host spelling to equal WHATWG's parsed lowercase hostname, refusing silent normalization. Bracketed IPv6 remains exempt from this equality check so valid IPv6 compression remains supported. The source change is limited to `parsePrivateHostHeader`; allow-set, forwarded-host policy, error redaction and disabled mode are unchanged.

GitHub checked-in source blob: `12152f05c83a140c5cdb0c1a413425b27c0fdaeb`. Test blob: `32044905231ed1224166b8edd372a3e970669d5c`.

## Actual execution and boundaries

- Isolated native Debian Linux Node 22.16.0 **source-equivalent** old parser reproduction: six noncanonical Host spellings were accepted as `127.0.0.1` (RED).
- Isolated native Node 22.16.0 source-equivalent repaired parser tests: **15 PASS / 0 FAIL** (10 denied, 5 admitted).
- This was NOT execution of the actual Bostan checked-in TypeScript module, Vitest/Supertest, TypeScript 7 or installed application. No full private checkout with preinstalled Node >=24.11 and dependencies was available. The seven authored Vitest cases remain UNRUN.
- No external network, model API, user files, Desktop Commander or paid infrastructure used. Only self-created temporary test scripts were deleted.

## Required next gates

Run `server/src/__tests__/private-hostname-guard.test.ts` against exact branch head with native pinned Vitest/Supertest and TypeScript 7. Then verify full authenticated HTTP and installed platform behavior, actual Linux rootless bubblewrap, PostgreSQL repeated teardown/crash issue #234, Windows compiled app #237, agent side-effect consent, privacy and license/NOTICE/provenance. **Release NO-GO.**
