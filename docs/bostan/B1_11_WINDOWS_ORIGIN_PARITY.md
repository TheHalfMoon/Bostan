# B1-11 — Windows first-admin origin-validation parity

Date: 2026-10-29. Private Bostan, stacked on B1-10 Draft PR #262. No merge, release, publish, deploy, Actions activation, paid provider or actual user data.

## Reviewed actual server contract, then repaired a missing native test

The branch's `server/src/routes/access.ts` POST `/bootstrap/claim` accepts only authenticated private session actors and returns `{claimed:true,userId}`; the existing test `server/src/__tests__/bootstrap-claim-routes.test.ts` asserts anonymous 401, repeated claim 409 and mutation-origin rejection 403. The `/auth/get-session` route returns session.userId plus matching user profile. Those were consistent with the B1-10 native Windows HTTP runner.

The macOS real private HTTP harness already exercised two additional **specific regressions** from B0-97 and B0-98, but the native Windows harness did not:

1. HTTPS Origin for a loopback HTTP server with **identical authority** must return 403. Matching host:port alone is insufficient; the URL scheme matters.
2. A forged Origin containing `/private/path` and an apparently trusted `Referer` must return 403. Browsers serialize Origin as scheme + authority only; a path is invalid even if the host matches. The Referer cannot override a hostile or malformed Origin.

These are **missing real-Windows qualification assertions**, not evidence that the currently patched Bostan server accepts the attacks. The production middleware is unchanged by B1-11.

## Implementation

- Added two actual `fetch` calls to `scripts/bostan-private-windows-live-http.mjs` with the signed-in synthetic first-admin cookie; each requires an exact **403** and uses an AbortSignal.timeout of 12,000ms and `redirect:"error"`. They occur before the absence-of-origin check, pending-state verification and the allowed first-admin claim, preserving proof that rejected attempts did not alter bootstrap state.
- Extended the fail-closed `scripts/bostan-private-windows-http-evidence.mjs` from 16 to **18 ordered unique stages**, with `BOSTAN_WINDOWS_LIVE_CROSS_SCHEME_CLAIM_DENIED` and `BOSTAN_WINDOWS_LIVE_NONCANONICAL_ORIGIN_DENIED` immediately after the existing spoofed-Referer stage.
- Updated the Node evidence suite to assert 18 stages and explicitly reject omission of either new stage. Updated source-level native runner assertions and relative order checks. Preserved B1-10's health-body deadline, child-close gate, native read-only orphan PostgreSQL scan and full cleanup conditions, and unconditional `releaseQualified:false`.

## Actually verified

On an isolated Linux Node **22.16.0** environment, `scripts/bostan-private-windows-http-evidence.mjs` was reconstructed **byte-for-byte** from the current private GitHub branch and verified with `git hash-object` to SHA `aa2aa1e0e87e56363db0e19c57041a76b03eef33`. `node --check` PASS, and ten actual `node:test` cases **10/10 PASS** on that exact module. They covered 18 ordered stages, removal of each stage (18 mutated cases), both Origin regressions, swapped stage order, duplicates, lifecycle failures, sparse/secret-contaminated arrays, and mandatory independent PostgreSQL process verification. Local test driver: isolated `bostan-origin-parity.test.mjs` (not the same file as the GitHub test suite).

The exact current GitHub source blobs:
- Native Windows HTTP runner: `979e7a200a69ecccc0804b6ad6b4f5024386363d`.
- Windows 18-stage evaluator: `aa2aa1e0e87e56363db0e19c57041a76b03eef33`.
- Updated repository evidence tests: `ec050e5a71d3fae30a09d53c99a348d4106d514d`.
- Updated native-runner source tests: `e662e9c9730859ce8a621c2539a0fcf1117ae407`.

A direct branch source audit passed **12/12 checks**: all 18 marker strings unique, emitted exactly once, emitted in declared order, both new probes before first-admin mutation, exact 403 checks, the intended hostile schemes/paths/Referer, retention of independent PG cleanup gate, the health deadline and release NO-GO. These are static checks; the new native runner's real HTTP requests have **not** been executed against the full Bostan server on Windows.

## Remaining gates

Native Windows exact-head full source server/embedded PG/Better Auth and 18-stage HTTP, PowerShell owned-process scan, Playwright/Chromium and desktop packaging are pending. Last measured C: free ~0.323 GiB was below B0-91's >=2 GiB system minimum; QA workspace and TEMP need >=6 GiB each. Previously exhausted authorized remote-computer quota must not be bypassed. Use only a fresh isolated owned matching `Bostan-B111-qa` / `Bostan-B111-temp` fixture when safety admission and legitimate access permit.

macOS must retake its full 16-stage HTTP on the latest branch, and the product still requires a real first zero-cost agent task, cross-platform E2E, recovery/backups, reproducible source and installable builds, licensing and privacy/security gates. Issues #237 and #234 remain open. Never touch unrelated user processes/files.

**Bostan PRIVATE, Draft, Actions OFF, release NO-GO.**
