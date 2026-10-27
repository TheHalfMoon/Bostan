# B0-55 — Actual Better Auth two-session company/task isolation on relocated Bostan

**2026-10-27.** Source baseline: B0-54 Draft PR #203, commit `4ba9d54f7849ecd45728eca0b8e0a30af9e5775b`. The Bostan repository stays **PRIVATE**, inherited GitHub Actions stay **DISABLED**, release remains **NO-GO**, and `main` is never merged/published by this qualification. No paid AI providers, real user accounts, or customer data.

## Why B0-54 was insufficient

Previous private acceptance on an actual compiled, relocated Bostan stage exercised company/task data separation **with a single `local_trusted` implicit board actor**. This actor intentionally has local administrative scope and cannot establish whether two *distinct authenticated user sessions* are isolated from each other's companies/tasks. It also cannot prove viewer read-only and effective session revocation.

## New isolated, fail-closed qualification

Added an independent opt-in `--run-relocated-authz` mode to `scripts/bostan-private-staged-full-app-acceptance.sh`, and corresponding `--run-deployed-authz <absolute-stage>` to the existing disposable PostgreSQL/HTTP smoke. The previously tested `--run`, `--run-dist`, `--run-deployed`, and `--run-relocated` paths remain unchanged. The authz mode requires a **real compiled production pnpm stage relocated to a new owned temp path**, its production dependency/SQL/helper assets, and actual ephemeral PostgreSQL; it launches the real server as `authenticated` with **private exposure and loopback binding**. A cryptographically random `BETTER_AUTH_SECRET` is generated for the invocation only; the auth public URL is restricted to `http://127.0.0.1:<ephemeral-port>`. Sign-up is enabled for this disposable test alone; no email delivery or external auth provider is used. Telemetry and cloud/model credentials remain disabled/unset.

The health smoke now correctly handles **redacted, anonymous authenticated health**: a never-provisioned server legitimately reports `status=ok`, `deploymentMode=authenticated`, `bootstrapStatus=bootstrap_pending` and omits the privileged `authReady` field. The old `local_trusted` health contract still requires `bootstrapStatus=ready` and `authReady=true`. No health endpoint privacy rule was relaxed.

Added `scripts/bostan-private-staged-authz-e2e.mjs`: read-only by default, with an explicit `--run --url http://127.0.0.1:<high-port>/` and strict **before-any-request** admission rules. It verifies the synthetic PostgreSQL ownership marker, exact loopback database host and `bostan_qualification` database name, private authenticated mode and exact origin. It generates `.invalid` email addresses and disposable password tokens; no production identities are queried. Synthetic admin/owner/viewer membership setup uses `psql` **only after validating the disposable database** and allows only validated alphanumeric user IDs and UUID company IDs to be interpolated into the synthetic test SQL. Secrets, session cookies and passwords are not printed into receipts.

## Genuine two-session checks

The workflow signs up **two different Better Auth users** against the real mounted auth endpoints and extracts two independent real session cookies. The first fixture user is granted instance-admin inside the disposable database only, then creates two companies with real POST requests. The second fixture user receives ownership of company B, while the first user's B membership is removed. The scenario then validates using HTTP requests with each signed session:

- Company detail: A cannot read B and B cannot read A (403 for both).
- Company-wide task list: A cannot list B and B cannot list A (403 for both).
- Task mutation: A cannot POST into B, B cannot POST into A (403 for both), but both can create their own tasks successfully (201).
- Company task listings/details: each user sees the correct own-company task and does not see the foreign one.
- Task UUID existence oracle: a real foreign-company task `GET` returns **the identical 404 JSON response** as a nonexistent UUID, preventing cross-company task ID enumeration.
- Viewer permissions and revocation: the second user receives a viewer membership of company A; reads A (200) but cannot create an A task (403). **With the original session cookie unchanged**, revoking that A membership makes both A detail and A task-list reads fail (403), confirming membership state reload rather than a stale session grant.
- Anonymous company access remains denied. All requests are restricted to loopback, finite timeouts, no redirects and a fixed API route allowlist. No agents or models are activated.

## Real executed evidence — authorized macOS arm64

**`bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated-authz` exited 0.** The *actual deployed/relocated Bostan server* booted and completed local SQL migrations; 375 SQL files, 72/72 direct production dependencies, the exact locked ACP SDK, 1,889 internal symlinks and 0 escaping symlinks all passed staging checks.

Actual signed-in test receipt `bostan.two-authenticated-sessions.v1`:

| Field | Proven result |
|---|---:|
| `sessionUsers` | 2 |
| `independentMemberships` | 2 |
| `crossCompanyDetailDenials` | 2 |
| `crossCompanyListDenials` | 2 |
| `crossCompanyWriteDenials` | 2 |
| `foreignTask404MatchesNonexistence` | 2 |
| `viewerReadAllowed` / `viewerWriteDenied` | 1 / 1 |
| `revokedMembershipAccessDenied` | 2 |
| `requests` | **27 genuine HTTP requests** |
| `providerCalls` | **0** |

Exit markers included `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PORTABLE_STAGED_AUTHENTICATED_TWO_SESSION_QUALIFIED`, `BOSTAN_PRIVATE_RELOCATED_TWO_SESSION_AUTHZ_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_RELOCATION_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, `CLEANUP_COMPLETED exit=0`. The temporary Bostan stage, signed-in synthetic accounts, ephemeral Postgres database and server were cleaned after the run. No persistent app or customer credentials were touched.

The separate real `local_trusted` source-mode PostgreSQL HTTP smoke was also rerun to check backward compatibility. Strict no-external-network/real-database mutation guard tests run under Node. Previous exploratory attempts were not counted: the first expected bootstrap-pending response was initially misinterpreted by the old local-only health check; another attempt was interrupted by concurrent edits to a running shell script. The successful final run was executed from stable scripts with the correct health-mode-specific acceptance.

## Remaining release limits

This is **two-user authenticated authorization integration** on a disposable private, loopback, source-built **macOS** staging deployment. The first user's instance-admin grant and owner/viewer memberships were intentionally seeded into the disposable test DB rather than fully exercising invitation onboarding and permission-grant UI, so those invitation workflows remain unqualified. It is not a production independent penetration test, not multi-node/cloud tenancy certification, and not a real-model qualification. Windows/Linux end-user installer, native Rust/GUI delivery, real free-model agent reliability, optional runtime adapter/peer closure, and an independent security/legal audit remain **OPEN**. Bostan release stays **NO-GO**; no merge/publication.
