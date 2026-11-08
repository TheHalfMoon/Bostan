# B1-36 supplementary Mac authentication and real embedded PostgreSQL evidence

Date: 2026-10-29. PRIVATE, stacked Draft-only, nonpublishing, no customer databases. Generated from **actually executed** on-device commands in the isolated `~/Bostan-B135-qa` checkout; source at B1-36 tested commit `14a600aa34a504a697ba87b7105011009428278f`. Actual installed dependencies and built workspace artifacts, not mocked command output.

## HTTP route-level authorization and login — Mac

```sh
CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  pnpm --filter @bostan/server exec vitest run \
  src/__tests__/auth-routes.test.ts src/routes/setup-token-route.test.ts \
  --maxWorkers=2
```

**EXIT 0, 2 test files passed, 47 tests passed**, 0 failures (Vitest run duration ~8.22s). Tests use actual Express+Supertest in-process request handling with synthetic users, fake transport and mocked database/service dependencies. They cover session profile authorization and setup-token login lifecycle, non-owner redaction and token-leak guardrails. This does **NOT** prove persisted Better Auth cookies against a full real PostgreSQL-backed Bostan server.

## Real embedded PostgreSQL migration — Mac

```sh
CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  pnpm --filter @bostan/db exec vitest run \
  src/better-auth-account-issuer-migration.test.ts --maxWorkers=1
```

**EXIT 0, 2/2 PASS**, including an actual embedded PostgreSQL test case that rewinds the issuer migration, seeds legacy account rows and re-applies the migration to ensure a NOT NULL backfill and unique issuer/account key. The suite used disposable database fixtures and registered proper cleanup.

## Real embedded PostgreSQL connection recovery — Mac

```sh
CI=true NODE_OPTIONS='--max-old-space-size=2048' \
  pnpm --filter @bostan/db exec vitest run \
  src/postgres-connection-recovery.test.ts --maxWorkers=1
```

**EXIT 0, 12/12 PASS**, exercising six driver disconnection/recovery scenarios each for ESM and CommonJS clients with an actual embedded PostgreSQL instance. The test code registers `afterAll` owned cleanup, uses bounded child processes and no persistent user database.

Across those exact distinct suites, **61 tests PASS, 0 FAIL**, without replacing any test result with inference. Database tests: **14 actually use embedded PostgreSQL**, route-level HTTP tests: **47 use fakes/mocks for persistence and transport**.

## What remains

Do not equate the above with a complete Bostan user journey, full 18-stage **native Windows** Better Auth/signup/first-admin/tenant isolation requirement (#237) or broad multi-suite orphaned Windows PostgreSQL io-worker proof (#234). Mac real compiled server health boot is recorded separately in `B1_36_MAC_COMPILED_SERVER_AND_WINDOWS_ESM_EVIDENCE.md`. Chromium, installers, genuine free local agent and platform privacy/provenance audits remain open. **NO-GO** for release. Keep repo PRIVATE, no Actions enable, protected-main merge, publish, deploy, release, npm pack, paid cloud/models, or real customer data.
