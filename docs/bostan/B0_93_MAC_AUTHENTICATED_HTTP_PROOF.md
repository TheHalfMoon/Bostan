# B0-93 — Native macOS real authenticated HTTP and synthetic PostgreSQL evidence

Date: 2026-10-28. PRIVATE Bostan stacked engineering, based on B0-92 Draft PR #243 exact head `7ee10cd5b9eb7718910851628a75290b3fc52d8c`. Do not merge, publish, deploy, enable Actions or run paid AI.

## Verified on authorized macOS host (manual native source smoke)

Isolated checkout `/private/tmp/bostan-b093` (Bostan-owned scratch), macOS Node 24.15.0, pinned pnpm 9.15.4. Initial disk headroom 17.54 GiB; roughly 17 GiB remained after dependency preparation. Frozen scoped install with ignored lifecycle scripts completed. The 17 selected internal workspace dependency builds (excluding server/runner) completed successfully. No operator/customer data, external agent or model credentials were used.

1. Real `startEmbeddedPostgresTestDatabase` on loopback, schema migrated; standalone trial reported `startMs: 9722` and `B093_OWNED_EMBEDDED_POSTGRES_CLEANUP_COMPLETE`, exit 0.
2. Separate native real `startServer()` trial with that disposable PostgreSQL: `B093_HTTP_POSTGRES_MIGRATED_MS=2437`, `B093_HTTP_INDEX_IMPORTED_MS=13542`, `B093_HTTP_SERVER_STARTED_MS=15153`.
3. Real loopback `GET /api/health` returned HTTP 200, `status=ok`, `deploymentMode=authenticated`, `deploymentExposure=private`, `bootstrapStatus=bootstrap_pending`.
4. Real synthetic Better Auth `POST /api/auth/sign-up/email` returned HTTP 200, user ID and session cookie. Synthetic email used `@example.invalid`; random disposable password was never reported.
5. Real session-cookie `POST /api/bootstrap/claim` returned HTTP 200.
6. Trial printed `B093_HTTP_AUTHENTICATED_LOCALHOST_PASS`, `B093_HTTP_SERVER_SHUTDOWN_COMPLETE`, `B093_HTTP_DB_CLEANUP_COMPLETE`, `B093_HTTP_QA_COMPLETE_EXIT=0`. The wrapper command finished with exit 0.

These are **actual native HTTP and PostgreSQL results**, not mocked route unit tests. The original manual trial did not assert post-claim `/api/health`; the subsequent test-only runner did record `BOSTAN_MAC_HTTP_POST_CLAIM_HEALTH_PASS`.

## Repeatable private B0-93 harness and honest qualification status

Added `scripts/bostan-private-mac-live-http.mjs` and `scripts/bostan-private-mac-live-http.test.mjs`.

- Default and `--plan` are inert; `--run` requires exact `BOSTAN_MAC_HTTP_QA=SYNTHETIC_ONLY`, a real private Bostan checkout under `/private/tmp/bostan-b0xx`, macOS Node >=24.11, 10 GiB free, installed/built dependencies and owned marker.
- Child receives a **minimal allowlisted environment** with isolated HOME/TMPDIR/PAPERCLIP_HOME, random synthetic Better Auth secret, local DB and private/authenticated server. No inherited user/provider keys, paid models, external deployment or real customer records.
- Real smoke asserts migrated PostgreSQL, HTTP health, synthetic signup and cookie, first-admin claim, post-claim health and awaited server/DB teardown. No source build, browser, tenant isolation or agent claim.
- Parent uses file-backed child logs, 110-second timeout, strict process exit/signal/error checks, capped log parsing and an isolated child process group. It signals only the owned group after child exit to address lingering `tsx`/`esbuild` helpers. A timeout can **never** be marked pass, even if all stage strings were printed. An uncertain PostgreSQL cleanup preserves the owned fixture instead of deleting potentially live data.
- On Mac, the earlier pre-fix harness passed **5/5 guard tests**. Its live retake printed all seven real stage markers, including post-claim health and teardown, but `spawnSync` waited 110 seconds for a lingering inherited pipe and returned `ETIMEDOUT`. That older wrapper incorrectly marked this a pass: **its repeatable qualification is invalid**. The new version fixes both the false-positive condition and pipe inheritance, and explicitly exits its child after awaited teardown. These final changes **have not been rerun on Mac** because the authorized remote device tool reached its monthly quota.
- Connector read-back of the final GitHub source confirmed **14/14 static invariants** (guard, privacy, local HTTP/PG, shutdown, strict timeout, file-backed logs and tests present). This is source inspection, **not a substitute for running the final Node test suite or live smoke**.

## Windows, cross-platform and release NO-GO

- Native Windows C: had only **0.323 GiB** free; D: had **17.649 GiB**. The prior B0-91 2 GiB system-disk admission gate must remain in force. No unsafe heavy Windows retry was performed.
- B0-87 issue #237 remains open: native Windows full source/compiled HTTP startup, real Better Auth and Chromium, tenant isolation and verified zero owned PostgreSQL orphans are not qualified.
- Playwright Chromium, compiled server build, reproducible installers, a zero-cost real agent workflow, security/licensing independence and production recovery remain outstanding.
- Due to the remote-tool quota, final native Mac retest, independent process-orphan check and removal of the B0-93 scratch checkout could not be completed in this run. **Do not claim those cleanup/qualification gates are closed.** No operator files were intentionally cleaned or altered.
- Bostan stays **PRIVATE**, GitHub Actions **OFF**, this PR **Draft**, no merge and overall **release NO-GO**.

Next safe action: rerun `node --test scripts/bostan-private-mac-live-http.test.mjs`, then `BOSTAN_MAC_HTTP_QA=SYNTHETIC_ONLY node scripts/bostan-private-mac-live-http.mjs --run` from a fresh isolated owned Mac checkout after device access returns. Require exit 0, all seven stages, `timeout:false`, zero owned PostgreSQL and esbuild descendants, and cleanup of test-owned scratch paths before qualifying the repeatable Mac gate. Keep Windows disk admission and all other release gates blocked until independently proven.
