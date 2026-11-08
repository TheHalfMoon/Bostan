# B0-64 — Eight-way first-admin race through actual compiled Bostan HTTP and PostgreSQL

**2026-10-27.** Stacked after B0-63 Draft PR #212 at commit `ca19f4292e571911bc41447ec7cf54c4aa609720`. Bostan remains **PRIVATE**, inherited GitHub Actions disabled, all PRs Draft/unmerged, no release or deployment, no customer accounts or paid provider/model calls.

## Previously missing evidence

B0-63 exercised the transaction-level first-admin lock on an embedded real PostgreSQL server, but it did not test independent HTTP requests authenticated with real Better Auth cookies on a compiled, relocated Bostan server. A server middleware/session-origin mapping bug could allow a different privilege outcome than the service integration test.

## New opt-in qualification mode

```sh
bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated-admin-race
```

New `--run-relocated-admin-race` (and internal `--run-deployed-admin-race`) uses the existing private frozen/offline build, compiled server+UI package, relocation inspection and PostgreSQL/HTTP runner. The test may only run against literal loopback with an exact disposable `bostan_qualification` database, owned temp sentinel, explicit private authenticated mode and the extra `BOSTAN_AUTHZ_RACE_HTTP=1` gate. The default/no-args mode remains nonmutating. Other preexisting `--run`, `--run-relocated-authz` and `--run-relocated-authz-ui` paths are preserved. No public APIs or production services were changed.

The new standalone `scripts/bostan-private-staged-admin-race-e2e.mjs`:

1. Requires actual health state `bootstrap_pending` and refuses an anonymous claim (HTTP 401).
2. Signs up eight distinct synthetic `example.invalid` principals and obtains real signed Better Auth cookies; no cookie, password or user ID appears in its receipt.
3. Starts **eight concurrent HTTP `POST /api/bootstrap/claim`** requests, requires exactly one HTTP 200 bound to its authenticated user, and seven HTTP 409 conflicts.
4. Independently reads committed `instance_user_roles` from the owned PostgreSQL database, requires exactly one `instance_admin` row, exactly matching the HTTP winner.
5. Requires `bootstrapStatus=ready`, then replays all eight authenticated requests and requires eight more HTTP 409 responses.
6. Writes only nonsecret totals and `providerCalls=0` to its acceptance receipt.

## Real macOS arm64 execution

- Source/shell/no-side-effect admission tests: **9/9 PASS**, **0 failures**, **0 skipped**. `bash -n`, `node --check`, and `git diff --check` succeeded.
- Full actual compiled private server + UI, frozen offline pnpm install, PostgreSQL migration, relocated stage and Better Auth multi-session race: **EXIT 0** (97.62 seconds).
- Production receipt `bostan.private-first-admin-http-race.v1`: `passed=true`, `syntheticOnly=true`, `independentSessions=8`, `concurrentClaims=8`, `successfulClaims=1`, `rejectedConcurrentClaims=7`, `committedAdminRoles=1`, `repeatedClaimsRejected=8`, `anonymousClaimRejected=1`, `providerCalls=0`.
- Real output markers: `BOSTAN_PORTABLE_STAGED_FIRST_ADMIN_RACE_QUALIFIED`, `BOSTAN_PRIVATE_RELOCATED_ADMIN_RACE_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_RELOCATION_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, **`CLEANUP_COMPLETED exit=0`**.
- The server-stage inspector reported **1,889 internal links and zero foreign links**, production-dependency closure valid, and 375 SQL migration files; this is stage inspection, not a cross-platform installer qualification.
- Unrelated dependency peer warnings (React type peers and Vitest version) were emitted by the isolated `pnpm deploy`, but the verified server/QA execution succeeded. These peer warnings need their own separate audit; they are **not** silently claimed resolved.

## Remaining work and decision

The code path now has both PostgreSQL transaction-level and actual compiled HTTP/Better Auth parallel first-claim evidence. This is **not** multi-host distributed load testing or external public deployment qualification. Native installed Windows/Linux GUI/server/runner, reproducible no-cost agent model task efficacy, broader security/permission threat-model review, third-party notices/license closure and public release preparation still remain separate work. **Release NO-GO**, no publication.
