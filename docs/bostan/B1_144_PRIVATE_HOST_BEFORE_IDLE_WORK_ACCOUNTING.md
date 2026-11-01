# B1-144 — Private Host Admission Before Idle-Work Accounting

Status: **PRIVATE DRAFT / UNMERGED / RELEASE NO-GO**. This is a narrow ingress-order hardening change, not installed-product qualification.

## Parent and issue

Parent: B1-143 private Draft PR #400, exact head `780a985ef4cf8385667fcfe466c1d8dd3bfb3f4c`. The parent `server/src/app.ts` registered `idleAdmissionMiddleware` immediately after `express()`, before the B1-142 `privateHostnameGuard` registration. The idle middleware calls `beginIdleTrackedWork()` for ordinary requests and increments the idle-work generation; a rejected, attacker-controlled private-mode `Host` therefore entered the idle-work accounting path before receiving HTTP 403.

A continuous stream of unauthorized Host requests could produce generation churn that interferes with idle/quiescence decisions. This is a demonstrated admission-order accounting defect, **not** a demonstrated sustained remote denial of service or a bypass of authorization.

## Fix

In `server/src/app.ts`, move the existing `app.use(idleAdmissionMiddleware)` directly after `app.use(privateHostnameGuard(...))` and before the first import/webhook/JSON body parser. There is still exactly one idle-admission registration. The private Host policy, allowlist, disabled-mode behavior, parser limits, session/agent permissions, network policy, dependencies and data are unchanged. Accepted requests remain idle-tracked. Rejected private Host requests are refused before an idle token can be allocated.

## Test-first coverage

Two new cases in `server/src/__tests__/idle-admission.test.ts`:

1. A real Express/Supertest fixture registers Host guard before idle admission, asserts denied `Host: blocked.invalid:3100` returns 403 with **no** idle snapshot generation/active delta, then checks `Host: localhost:3100` returns 204 with the expected +2 generation delta and zero active work.
2. A source-order regression assertion reads the checked-in `app.ts`, requiring the production Host guard to precede the **single** idle registration and both to precede the import JSON parser.

These checked-in Vitest cases are **AUTHORED, NOT EXECUTED** in a full Bostan checkout. They require the repository's installed dependencies and supported Node version.

## Actually executed isolated evidence (2026-11-01 Asia/Riyadh)

On model-side Debian Linux Node **22.16.0**, a disposable owner-only `/tmp/bostan-b144-order-*` harness used a real Node HTTP server and real loopback requests with an isolated equivalent of the existing idle token and private Host middleware. **4/4 assertions passed**: old order denied Host 403 with +2 generation; old order accepted Host 200 with +2; new order denied Host 403 with +0; new order accepted Host 200 with +2. In all cases active tokens returned to zero. The harness and its temporary directory were deleted. This proves the isolated ordering mechanism, **not** the full Bostan Express runtime.

Separately, the exact post-commit private GitHub `app.ts` and test source were re-fetched. **7/7 read-only structural checks passed** (one Host guard before idle, one idle registration before the body parser, and test coverage present). Verified GitHub Git blobs: `app.ts` **`6f4df63167725e7bd791ca9ceab35ed4a9e3db5c`** and `idle-admission.test.ts` **`0815d0718a4ba75755b682e800cc94f297ddaaca`**. Structural checks are not source-native Vitest.

## Remaining qualification

Run the exact checked-in idle-admission and private-host Vitest/Supertest suites on an authorized private checkout with Node >=24.11 and installed dependencies, then full TypeScript7 and all Linux source-native/rootless bwrap gates. Check actual installed Windows/macOS/Linux, Windows PostgreSQL repeated crash/stress #234, Windows authenticated HTTP #237, agent effects/consent, privacy/tenant isolation and third-party LICENSE/NOTICE provenance. Do not claim any release gate green from this bounded test.

No main merge, public repository, GitHub Actions, publication, release, deployment, paid provider, customer data, foreign deletion or required attribution removal.
