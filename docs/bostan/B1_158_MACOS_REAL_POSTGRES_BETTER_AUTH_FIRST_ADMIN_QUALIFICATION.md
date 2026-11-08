# B1-158 — Native macOS authentication, authorization, and real PostgreSQL qualification

Status: **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO**. Verified on 2026-11-01, Asia/Riyadh.

## Source identity and test environment

- Direct parent: private B1-157 Draft PR #414, exact HEAD **5e76cbf13fd75f05b138938f4237037021f5d7ee**.
- Authorized Apple Silicon Mac, Darwin/macOS, **Node v26.0.0**, **Vitest v5.0.3**, 8 GiB installed RAM.
- Existing clean full private Bostan QA worktree with pinned dependencies and original detached HEAD **88e0274412c2e6cbadd07534960b20184907f291**. Fetched the exact private B1-157 commit, detached checked out, and verified clean before testing.
- Seven native source test files each ran in a **separate** Vitest process with a single worker to avoid resource contention. No new project clone, paid provider, deployment, external data, customer account or GitHub Actions.

## Actually executed tests on exact checked-in source

Each test file was run with the following standalone command from the server package, replacing the test filename:

~~~sh
cd server
./node_modules/.bin/vitest run src/__tests__/TEST_FILE --config vitest.config.ts --pool=forks --maxWorkers=1
~~~

| Vitest source file | Pass | Fail | Exit | Tested boundary |
| --- | ---: | ---: | ---: | --- |
| auth-routes.test.ts | 17 | 0 | 0 | Express/Supertest authentication route tests with mocked dependencies |
| bootstrap-claim-routes.test.ts | 11 | 0 | 0 | First-admin bootstrap route contract with mocked service |
| auth-session-route.test.ts | 12 | 0 | 0 | Session and actor handling with mocked data dependencies |
| better-auth.test.ts | 18 | 0 | 0 | Cookie scope, trusted origins, Better Auth option policies |
| authz-company-access.test.ts | 19 | 0 | 0 | Company authorization, read/write role boundaries |
| better-auth-credential-signup.integration.test.ts | 1 | 0 | 0 | REAL temporary migrated embedded PostgreSQL and Better Auth |
| first-admin-claim.test.ts | 4 | 0 | 0 | REAL temporary embedded PostgreSQL first-admin claim |
| **Total, seven individual source test files** | **82** | **0** | **0 each** | Native macOS Vitest5 |

**77/77** tests across the five dependency-mocked suites passed. **5/5** tests using real disposable PostgreSQL databases passed and were **not skipped**.

## Real Better Auth credential and admin qualification

The actual source integration sign-up test passed: local HTTP 200 synthetic sign-up creates a real user and credential account in a migrated ephemeral PostgreSQL schema, then local HTTP 200 sign-in returns a session cookie. This covers the Better Auth/Drizzle real schema compatibility that mocks cannot prove. The separate first-admin source test file passed four cases against its own temporary PostgreSQL fixture.

These test files provision and clean up disposable database fixtures using their explicit afterAll cleanup functions. This is not the fully booted production HTTP server or Chromium signup flow.

## Owned resource and cleanup checks

- A read-only macOS memory guard measured **48% and 47% free memory** before the two real-DB test launches, above a self-imposed safety floor of 35%.
- Following test completion, a narrow read-only TEMP check found **zero remaining matching disposable PostgreSQL fixture directories**. The system's existing Homebrew PostgreSQL service was seen separately; it was **never modified or terminated** and must not be confused with the isolated embedded test instances.
- The original Mac checkout was returned to detached HEAD **88e0274412c2e6cbadd07534960b20184907f291** with **clean git status**. Durable evidence is in private GitHub.

## Release blockers still unqualified

1. Native Windows issue **#237** remains OPEN: compiled/authenticated Windows loopback server must actually boot with required health state, synthetic Better Auth + first admin flow and real Chromium frontend.
2. Native Windows issue **#234** remains OPEN: real stress and forced-crash PostgreSQL worker teardown must prove zero owned io_worker orphans (mocked teardown tests do not suffice).
3. Complete root Vitest and TypeScript7, genuine Linux unprivileged rootless bwrap, installed Windows/macOS/Linux journeys, agent side-effect consent, tenant isolation and legally required LICENSE/NOTICE/provenance review are outstanding.

These successful native Mac tests constitute meaningful real code and real database evidence but **not full Bostan release readiness**. Do not merge, publish, deploy, enable Actions, spend on paid services or process customer data. **RELEASE NO-GO.**
