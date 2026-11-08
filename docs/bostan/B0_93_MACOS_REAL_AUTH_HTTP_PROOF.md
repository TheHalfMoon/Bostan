# B0-93 — Real native macOS private authenticated HTTP proof

Date: 2026-10-28. Private stacked work on B0-92 PR #243. **No release, publication, main merge, GitHub Actions, paid models, or operator/customer database.**

## Verified Mac run

- Native macOS Node **24.15.0**, frozen-lockfile pnpm **9.15.4**; scoped dependency install and **17 internal workspace projects** built (excluding the standalone runner and final compiled server).
- Actual `startEmbeddedPostgresTestDatabase` successfully initialized and migrated a fresh, temporary, loopback-only PostgreSQL instance in **9,722 ms** in a first independent check. Its `cleanup()` completed.
- A second, bounded ad hoc source-server process used a synthetic, isolated HOME/TMPDIR/PAPERCLIP_HOME and random credentials with no AI-provider keys. The live `startServer()` completed in **15,153 ms**, including PostgreSQL initialization and source import. `GET /api/health` returned **HTTP 200**, `status=ok`, `deploymentMode=authenticated`, `deploymentExposure=private`, `bootstrapStatus=bootstrap_pending`.
- Synthetic `POST /api/auth/sign-up/email` returned **HTTP 200**, a user id, and a session cookie. Authenticated `POST /api/bootstrap/claim` returned **HTTP 200**. The server's `shutdown()` and the test PostgreSQL `cleanup()` both completed, and the process exited **0**.
- In a subsequent script-based run, the logs recorded PostgreSQL migration, authenticated private health, synthetic signup, first-admin claim, **post-claim health**, server shutdown, and database cleanup. **However the first harness falsely counted success despite a 110-second subprocess timeout** because a grandchild held an inherited stdout pipe open. A fix was prepared locally: file-backed child stdio, requiring zero exit, no signal and no timeout, plus explicit child exit after server/DB cleanup.
- The **final changed harness did not receive a verified end-to-end rerun**: the authorized Desktop Commander session reached its monthly usage limit before the test result could be read. Do **not** claim that the modified harness is fully qualified. The prior full-server ad hoc run is genuine evidence of macOS application behavior, but distinct from final harness qualification.

## Safety boundaries

The proposed reusable harness is inert unless explicitly opted in, uses a private `/private/tmp/bostan-b0xx` checkout and test-owned fixture, statfs volume headroom, a minimal environment without inherited paid-provider credentials, localhost-only PostgreSQL and HTTP, bounded child execution, and safe numeric summary output. Temporary database files may only be deleted after verified PostgreSQL cleanup; failed/uncertain cleanup preserves the fixture.

## Remaining gates

Windows C: had only ~0.323 GiB free (versus B0-91's 2 GiB minimum), so Windows live HTTP import, authenticated login, Chromium/Playwright, real agent tasks, complete compiled production build, installers and security/licensing remain **OPEN**. macOS HTTP proof does not qualify Windows or release.

**Bostan PRIVATE — release NO-GO. Keep this PR in Draft.**
