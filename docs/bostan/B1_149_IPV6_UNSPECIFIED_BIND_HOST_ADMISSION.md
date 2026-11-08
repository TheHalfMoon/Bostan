# B1-149 — IPv6 unspecified bind Host admission (private draft)

Status: **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO**. Date: 2026-11-01 Asia/Riyadh.

## Verified parent and defect

Parent: B1-148 Draft PR #405, branch `work/b1-148-reject-obs-text-private-host`, exact commit `32b0754d83e47c9a0ab45fa83004de05a8a7ca57`. The parent module `server/src/middleware/private-hostname-guard.ts` is exact Git blob `6b16fb7688617603400ed02448ee5a1a09aedc0e`.

The existing implicit bind-Host allowance excluded IPv4 unspecified `0.0.0.0` but **not** IPv6 unspecified `::`. With `bindHost: "::"`, `resolvePrivateHostnameAllowSet` included `::`; an HTTP `Host: [::]:3100` was admitted, and `isPrivateUpgradeHostAllowed` admitted the same authority for WebSocket upgrades. `::` is a bind-all address, not a client-facing authority. This is an authority-policy discrepancy, **not** proof of external remote exploitation.

## Test-first native source execution

Runtime: Debian Linux, Node `v22.16.0`, no Bostan runtime dependencies or paid services. Command:

```sh
node --experimental-strip-types --test scripts/bostan-private-bind-host-authority.test.mjs
```

The test imports the **actual checked-in TypeScript middleware** using Node's type stripping. No reimplementation of `parsePrivateHostHeader`, `resolvePrivateHostnameAllowSet`, `isPrivateUpgradeHostAllowed`, or `privateHostnameGuard` is used. Two cases send actual Node HTTP requests to an ephemeral loopback listener with a minimal Express response adapter; the remaining cases call the actual exported module functions. This is a focused source-native module test, **not** an installed Express/Vitest/Supertest or full Bostan application test.

Before the fix, the 10 authored cases against the **exact parent blob** yielded **6 PASS / 4 FAIL**, specifically the wildcard allow-set assertion, WebSocket admission, HTTP middleware admission, and native HTTP denial. Parent file SHA was verified using `git hash-object`.

After the fix, all **10 PASS / 0 FAIL**. Both exact files were verified against their private GitHub blob SHAs and local `git hash-object`:
- middleware: `76cbb0f257f45cf5b7519d3f18ee05632723420a`
- native test: `c5cb41167ba54c60759411f9201bd9cac38b887e`

## Narrow fix and compatibility

Only the implicit bind-host allow-set condition changes: exclude `::` alongside `0.0.0.0`. Explicit operator allow-list semantics, canonical loopback `localhost`, `127.0.0.1`, `::1`, non-wildcard bind names, public-mode behavior, raw Host validation, error redaction, and WebSocket Origin checks are unchanged. Tests assert these controls.

## Outstanding release blockers

**NO-GO** until authorized Node >=24.11 full private checkout, full Vitest/Supertest, TypeScript 7, docs/UI preflight, rootless `bwrap` sandbox integration, Windows PostgreSQL forced-crash/no-orphan #234, authenticated HTTP/BetterAuth/Chromium #237, installed Windows/macOS/Linux journeys, agent consent/tenant privacy, and legal LICENSE/NOTICE/provenance qualification. No main merge, GitHub Actions, deployment, release, publication, paid provider, customer data, or foreign file/process deletion.
