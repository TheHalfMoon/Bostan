# B0-56 — Real human invitation, role promotion and suspension on private authenticated Bostan

**2026-10-27.** Stacked Draft based on B0-55 PR #204 at `12cca1cf20bdd77e2bf59df9ab60f2782e9e30e5`. The Bostan repo stays PRIVATE, inherited GitHub Actions disabled, no merge into main, no publication/deployment and no paid model calls. This is a **synthetic-only** user/session test on an owned disposable PostgreSQL database and an offline source-built, privately relocated production app on macOS arm64.

## Why the prior test was not sufficient

B0-55 actually authenticated two Better Auth sessions, created companies and tasks, rejected cross-tenant access and checked viewer read-only and membership revocation. However the owner/viewer records for these earlier tests were seeded with direct, strictly guarded SQL into a temporary database. That does **not** qualify the product's actual human invite link and its membership-management APIs.

## Real API-only invitation lifecycle added to the existing two-session scenario

After the original B0-55 authorization checks, `scripts/bostan-private-staged-authz-e2e.mjs` now performs an **additional production-API-only human invitation lifecycle**; it uses **no direct membership SQL writes for this new flow**. The same two Better Auth session cookies are preserved. The original B0-55 synthetic SQL fixture remains solely as prior-test setup; the instance-admin bootstrap for first-company creation remains test-only SQL and is not a claim that production setup/owner-claim UI was qualified.

1. The other user cannot create an invitation to a company for which that user has no membership (real **403**).
2. The owner/admin creates an actual `POST /api/companies/:id/invites` human-only invitation with `humanRole=viewer` (real **201**). The invitation token is checked for company scope and format and **never logged**.
3. The second, separately authenticated user accepts `POST /api/invites/:token/accept` (real **202**, join request already `approved`, matching user/company), proving the production invitation code creates the human membership.
4. The new viewer can read the shared company but cannot create an issue there (200 / **403**).
5. The viewer cannot self-promote through `PATCH /api/companies/:id/members/:memberId` (**403**). The original owner can list members and verify the invited principal's `viewer`, `active` membership record.
6. Owner changes that membership to `operator` through the **actual member update API** (200). The still-signed-in invitee can now **create a task** (201), proving the promotion takes effect for subsequent requests.
7. Owner changes the membership status to `suspended` through the **actual member API** (200). The same unchanged invitee cookie receives **403** for company detail, task list and task creation, proving that stale session grants do not survive suspension.

Extended the internal local route allowlist only to the required `/api/companies/:uuid/invites`, `/api/invites/pcp_invite_.../accept`, `/api/companies/:uuid/members` and `/api/companies/:uuid/members/:uuid` paths. The scenario still refuses external hosts, TLS, non-ephemeral databases, missing ownership marker, arbitrary file paths, redirects and any paid provider invocation. It never emails real recipients (`.invalid` synthetic signups); invitation creation and consumption are local HTTP only.

## Real executed evidence

`bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated-authz` **EXIT 0**, starting from the frozen offline pnpm dependency closure and native Mac TypeScript/UI build, private production deploy, stage relocation and verification, SQL migration, real Better Auth and HTTP on isolated local PostgreSQL.

The final `bostan.two-authenticated-sessions.v2` receipt printed `passed=true`, `releaseQualified=false`, **40 actual HTTP requests**, two session users, two independent company memberships, cross-tenant read/list/write denials, matching foreign/nonexistent issue 404s, viewer read/write checks, and these new fields:

- `inviteCreated=1`, `inviteAcceptedViaApi=1`
- `inviteeViewerRead=1`, `inviteeViewerWriteDenied=1`
- `unauthorizedInviteDenied=1`, `unauthorizedPromotionDenied=1`
- `promotionEnablesOperatorWrite=1`, `suspensionDenialsSameSession=3`
- `syntheticOnly=true`, `providerCalls=0`

Markers: `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PORTABLE_STAGED_AUTHENTICATED_TWO_SESSION_QUALIFIED`, `BOSTAN_PRIVATE_RELOCATED_TWO_SESSION_AUTHZ_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_RELOCATION_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS` and `CLEANUP_COMPLETED exit=0`. Bostan server and Postgres were stopped, temporary stage removed, user/account/invitation/task data deleted. No main merge, model call, fee or publication.

## Not qualified by this evidence

The *UI click-through* invite workflow, admin first-claim process, email delivery, additional company roles and permissions/grant combinations, independent adversarial security audit, Windows and Linux installers, native Rust app, real agent/model end-to-end benchmarks and optional provider/module closure remain OPEN. Release **NO-GO**. Preserve licensing/protocol identifiers and maintain Draft PR stack.
