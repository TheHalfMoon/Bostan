# B1-142 — Admit private Host authority before body parsing

Status: **PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO**. Stacked directly on B1-141 Draft PR #398 at pinned parent `7c23768d0bddb418cb02bcfeed868c7e51981d1e`. No publication, merge to main, Actions, deployment, paid provider, or customer data.

## Source-backed finding

At the exact B1-141 parent, `server/src/app.ts` registered the import JSON body parser, signed chat-webhook diagnostics/body parser, default JSON parser, API compression, and HTTP logger **before** `privateHostnameGuard`. Consequently a private-mode request with a disallowed Host could consume request-body parsing resources and invoke webhook diagnostics before the Host admission decision. This is a **pre-admission work and denial-of-service exposure**, not a proven authentication bypass, external network access, or tenant breach.

## Test-first change

The new regression in `server/src/__tests__/app-private-hostname-gate.test.ts` reads the actual app registration source and requires exactly one private Host middleware, placed after `applyTrustProxy` but before the import JSON parser, chat webhook parser, default JSON parser, API compression, and HTTP logger. It fails closed on a missing registration. This is a source-order contract; it does **not** execute the full Bostan application.

The production change in `server/src/app.ts` moves the **existing unchanged** `privateHostnameGuard` registration and existing `privateHostnameAllowSet` computation to immediately after `applyTrustProxy`, before the three body parser paths. No change to allowed hosts, enabled-mode policy, authorization, route bodies, request-target validation, dependencies, or user data. The initial `idleAdmissionMiddleware` remains before the Host guard; its separate behavior still requires source-native integration review. The logger now follows the Host gate, so denied private Host requests will not reach that logger; this logging/telemetry tradeoff needs deliberate review.

## Actually executed evidence (2026-11-01 Asia/Riyadh)

- **RED against exact parent source** `server/src/app.ts` Git blob `d776467dfcdcffa2cf27fed358136e56a6256253`: all five parser/compression/logger registration ordering assertions failed (5/5 before Host gate). The new regression was committed first.
- **GREEN against exact updated GitHub source** blob `6dcac72f3539a1a0591274ad9674a4afa56b21ea` and committed regression blob `c79c4ab21899f8b2331fce545fd2f6b0bc6965ad`: 10/10 JavaScript source-order checks passed in an isolated V8 evaluation. These checks included one Host gate, trust-proxy and idle-admission order, five downstream middleware positions, private-deployment policy, and regression presence.
- **Independent native Node 22.16.0 Linux HTTP loopback probe**, using only a disposable owned `/tmp` script and built-in `node:http` (not the Bostan application): 8/8 assertions passed. Under equivalent old ordering a denied Host POST was rejected with HTTP 403 **after** the synthetic body parser consumed 131072 bytes; under corrected ordering it was rejected HTTP 403 with zero parser invocations. Allowed Host and disabled-guard requests still consumed 131072 bytes and returned HTTP 200. Owned scratch was deleted.
- **NOT RUN:** checked-in Vitest test, actual `createApp` integration with Express, TypeScript 7, full Bostan Node >=24.11 checkout, installed Windows/macOS/Linux product, or genuine rootless Bubblewrap.

## Remaining mandatory qualification

On an authorized, owner-marked, PRIVATE full checkout pinned to this PR head, run `server/src/__tests__/app-private-hostname-gate.test.ts` and `server/src/__tests__/private-hostname-guard.test.ts` in actual Vitest/Supertest, strict TypeScript 7, and an integration case sending a large disallowed-Host import/webhook body to verify no parser/diagnostic side effects. Review rejected-request logging and whether `idleAdmissionMiddleware` has any pre-admission effects. Continue the four Linux rootless Bubblewrap cases, Windows PostgreSQL repeated stress/forced-crash issue #234, Windows compiled authenticated HTTP issue #237, installed three-OS journeys, agent consent, tenant/privacy/security, and upstream LICENSE/NOTICE/provenance. **Release remains NO-GO.**
