# B0-87 — Native Windows staged server startup diagnosis

2026-10-28 — Private Bostan stacked Draft after B0-86 PR #236. No release, no merge to main, no Actions, paid inference, managed Cloud or customer records.

## Existing obstacle

B0-86 successfully ran **28/28 real Express/Supertest auth/first-admin route tests** and **3/3 selected real native Windows PostgreSQL 18.1 pool/migration/reset tests** (with zero orphaned PostgreSQL child processes). But its actual, complete authenticated Windows server attempt twice failed to reach the private localhost readiness gate. The runtime source server did not emit an immediately identifiable error, so the prior check could not distinguish a heavy import from a blocked startup routine.

## New diagnostic change

- Native Windows isolated QA only: a separate diagnostic entry module reports fixed, secret-free stages `static_import_start`, `static_import_complete`, `runtime_start`, `runtime_ready`, or `runtime_failed`. The normal production server is untouched.
- Use an actual **file://** ESM module URL for the server entry; a Windows D: filesystem path is not a valid Node ESM import specifier.
- The diagnostic entry **refuses** direct use without the explicit B087 synthetic marker, loopback PostgreSQL connection, private authenticated deployment and other owned-fixture conditions.
- The parent test driver captures only bounded stderr/stdout in memory, reports the last allowed stage, an enumerated health observation and elapsed seconds, never arbitrary raw server errors, secret URLs or the full environment. The browser/signup/admin steps still need a real ready server and are not waived.
- Startup observation is bounded at 180 attempts; it does not treat an unanswered health check as success. The temporary PostgreSQL and synthetic home are disposed only after the process has been stopped.
- Existing default-inert and rejection tests include direct unsafe-entry denial; Mac and native Windows source/contract tests **8/8 PASS**. Native Windows Plugin SDK and Shared legal notice build also **exit 0**.

## Live native Windows status

The isolated full PostgreSQL + authenticated localhost server retake is being measured. Record results and any independent auth session or first-admin evidence only after verified runtime exit and zero owned PostgreSQL child processes.

## Release blockers

Native Windows full HTTP server and Chromium acceptance remain OPEN unless they reach real readiness and browser/session assertions. Free-model agent task completion, independent security/licensing, and installed app qualification remain OPEN. **Overall release NO-GO**, repository PRIVATE.
