# B0-77 — Actual Chromium authenticated web UI qualification on native Linux ext4

**2026-10-28.** Scoped local synthetic private QA only. Bostan overall release **NO-GO**. Stacked private Draft on B0-76 PR #225 (head `b68f1f71512bc9304f8383fe517dfb20baf67bb0`). Never merge to `main`, enable Actions, publish, deploy to customers, or use paid AI.

## Feature and safety gates

The previously verified default-inert Linux native production-stage QA runner now supports a **third explicit mode**: `--run-authz-ui`. It keeps unchanged `--run-authz` and `--run-admin-race` modes, the native glibc build + source/stamp and resource admission gates, pinned vendor runtime, real Vite UI build, frozen **offline** production deploy, 375 bundled SQL migrations, internal-only symlinks, production dependency inventory, legal font notices, temporary private PostgreSQL, loopback HTTP and strict owned tmpfs cleanup. The new mode checks that `@playwright/test` is already installed; it performs **no browser download or package installation**. It then runs the established private `--run-deployed-authz-ui` scenario using actual Chromium, not a mocked browser.

Focused Mac source and fixture security/negative tests: **18/18 passed**, 0 failures, 0 skips. Shell syntax and staged diff checks passed. Unrecognized or publication flags remain rejected; default is inert. Production sign-up/first-admin/membership code is unchanged.

## Real browser and production-stage evidence

- Test OS: actual **Ubuntu 26.04 WSL2 Linux x64 glibc**, source/dependencies on **native ext4** rather than Windows-backed DrvFS; Linux Node **24.19.0**, native TypeScript **7.0.2** and Rolldown **1.2.5**.
- Used the free Playwright distribution to install the exact **Chromium Headless Shell 151.0.7922.34** into a **disposable QA-only Linux cache** (267 MB including FFmpeg), not a global application. An independent headless browser launch and synthetic local DOM/title test both passed with exit 0 before invoking Bostan.
- Real Bostan production UI rebuilt on Linux and deployed **offline** into an owned private stage in canonical Linux `/tmp`. Actual stage verification: **375 SQL migration files**, **1,902 internal symlinks**, **0 foreign links**, **72 production dependencies**, included built UI, pinned ACP SDK, **3** staged board fonts and **3** legal files, source copyright unchanged.
- Actual private PostgreSQL migrated and compiled localhost `/api/health` returned **HTTP 200**, `authenticated`, `private`, `bootstrap_pending`.
- Actual Chromium created the **first real synthetic user through the rendered sign-up form**, captured its real Better Auth session cookie **in memory**, claimed the first `instance_admin` role **via the rendered Chromium UI**, and confirmed the role belonged to the same account. A second signed-in user and anonymous caller could not claim the first-admin role.
- Real Chromium performed Members/Invites flows: **invite created**, accepted by a **third authenticated session**, read-only viewer task write denied, UI promotion enabling writes, suspended memberships denying access (2 browser checks), and **2 member UI updates**.
- The combined authenticated fixture passed with **3 synthetic browser/HTTP sessions**, **47 HTTP requests**, tenant access isolation, role and invite controls, **0 browser JavaScript errors**, **0 external browser requests**, **0 provider/model calls**.
- Actual terminal markers: `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PORTABLE_STAGED_AUTHENTICATED_TWO_SESSION_QUALIFIED`, `BOSTAN_LINUX_NATIVE_STAGED_CHROMIUM_AUTHZ_UI_PASS`, `BOSTAN_LINUX_NATIVE_QA_CLEANUP exit=0`, `B077_REAL_LINUX_NATIVE_CHROMIUM_AUTHZ_UI_PASS`, **`B077_REAL_LINUX_CHROMIUM_UI_EXIT=0`**, runtime ~365 sec including source validation, UI build, production-stage construction, browser and cleanup.
- All accounts used generated `.invalid` addresses and synthetic passwords; no real patients, customers or paid AI.

## Qualified scope / remaining work

The scoped native Linux **private production web UI** (sign-up, bootstrap admin, membership and invitation) now has actual browser-backed evidence in addition to B0-75 backend authz and B0-76 eight-user HTTP race. This does **not** qualify a native Linux **desktop/installer**, a native Windows production installation, a fully independent upstream dependency license audit, live free-model agent task completion, entire UI navigation/regression coverage or release security sign-off. Bostan remains private and unreleased; all stacked PRs are Draft/unmerged. **Bostan overall release NO-GO.**
