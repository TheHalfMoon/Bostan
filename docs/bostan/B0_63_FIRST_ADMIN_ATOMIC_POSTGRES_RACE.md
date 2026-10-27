# B0-63 — First-instance-admin atomic concurrency and transaction rollback

**2026-10-27.** Private stacked Draft after B0-62 PR #211 (`3305a9f6770003f639e996eecea8a7bcc9bb0278`). No merge into `main`, release, deployment, GitHub Actions enablement, provider calls, real users, or paid compute.

## Risk and gap

B0-58 qualified a single actual Chromium **Claim this instance** request followed by a second user's 409. The existing `claimFirstInstanceAdmin` integration suite checked only sequential claims and an ordinary successful transaction. A parallel request race and failure of the optional `onClaim` callback were not independently proved against a database. A regression here could give multiple separately authenticated accounts instance-admin privileges or leave an administrator row after an incomplete ownership flow.

## Change

In the existing, owned ephemeral `server/src/__tests__/first-admin-claim.test.ts` PostgreSQL integration test suite:

- Launch **eight simultaneous PostgreSQL transactions** with independent synthetic user IDs, holding the successful `onClaim` callback's transaction long enough to force lock contention.
- Require exactly **one** `claimed` winner, **seven** `already_claimed` losers, each with the winner's real user ID; verify exactly one persisted `instance_admin` role and exactly one `onClaim` callback.
- Throw a controlled error inside `onClaim` and require its entire transaction to roll back, including the role record; require the next independent account can then claim successfully with exactly one persisted role.
- The production `claimFirstInstanceAdmin` table-lock protocol, migrations, authentication rules, role grants and pre-existing tests **remain unchanged**.
- Renamed the test-only disposable database prefix to Bostan, without changing persistent schema or compatibility protocols.

## Executed qualification on macOS arm64

- Installed private scoped server workspace dependency closure via **offline frozen-lockfile pnpm** with scripts disabled.
- First exploratory `vitest` invocation: the **4 embedded PostgreSQL integration tests passed**, but companion API route test could not load `@bostan/plugin-sdk` (not yet built in the fresh isolated source checkout). This was a missing test build artifact; **not** a product test failure and **not** a successful complete gate.
- Built the workspace SDK and its shared prerequisite with `pnpm --filter @bostan/plugin-sdk build` (exit **0**).
- Exact retake:

```sh
pnpm --filter @bostan/server exec vitest run \
  src/__tests__/first-admin-claim.test.ts \
  src/__tests__/bootstrap-claim-routes.test.ts --maxWorkers=1
```

**PASS: 15 tests**, **2 test files**, **0 failed**, **0 skipped**, exit **0**. Of these, **4 tests** exercised real isolated embedded PostgreSQL including 8-way concurrency and rollback; the **11 route tests** exercised auth/private exposure, duplicate claims and board mutation origin guard with mocked service responses. Temporary embedded database teardown ran through the existing cleanup handler. No user accounts, provider endpoints, or external database was touched.

## Boundaries

This does **not** replace load testing or a multi-process distributed concurrency test through the compiled HTTP app; those remain follow-ups. The existing 8-way test verifies one live PostgreSQL process with multiple transaction connections. Full Windows native installation, Linux server packaging, no-cost agent task efficacy and security/license sign-off remain unqualified. **Release NO-GO**, repository PRIVATE, Actions OFF, PR Draft.
