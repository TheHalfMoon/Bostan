# B0-31 — Live macOS local Bostan persistence and shutdown regression

**Private development, no deployment or release.** October 24, 2026.

## What this proves

A test running against the CURRENT B0-30+ source frontier used a fresh
isolated, automatically generated TEMP `HOME`; the ordinary user profile,
PostgreSQL service and previous Windows QA worktree were untouched.

- Spawned real `node cli/src/bostan-preview.mjs app run --local --port <random>`.
- Real `initdb` created a new private PostgreSQL 17 data directory, server
  migrations initialized the database, `/api/health` returned HTTP 200 with
  `status=ok`, `deploymentMode=local_trusted`, `deploymentExposure=private`.
- Real `POST /api/companies` persisted a unique synthetic UUID/name.
- Graceful SIGTERM shut down the application and PostgreSQL, with process
  exit code **0**, no `run.lock` and no `postmaster.pid`.
- Restarted a fresh server + the **same private database**, checked health,
  and verified the original company UUID/name using `GET /api/companies`.
- Graceful SIGTERM shutdown passed again, with both markers absent. The
  inspected one-off TEMP profile was then safely removed.
- After this initial live smoke, the reusable source test
  `scripts/bostan-local-live-persistence-e2e.mjs` repeated the entire live
  sequence: **PASS**, process exit **0**, with no retained TEMP profile.

## Reusable test admission

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`

- Requires exact explicit confirmation **before filesystem/network access**.
- Supported for macOS/Linux source runtime only. Windows continues to require
  its distinct guarded private TEMP-only QA startup. No bypass by flag.
- Creates a fresh private `0700` synthetic HOME, chooses a loopback ephemeral
  port, waits with bounded timeouts, and issues only localhost HTTP requests.
- Executes real CLI twice. Never uses an LLM/model, nonlocal inference,
  real user data, paid provider or public deployment. Never renames/overwrites
  a pre-existing user Bostan data directory.
- Verifies clean shutdown and removes only its own newly created TEMP profile
  after success. On an unexpected failure, refuses to delete the profile,
  allowing safe inspection of a possibly running PostgreSQL data directory.
- Standalone admission tests: **3/3 PASS**. `git diff --check` PASS.

## Limitations

This qualifies **only** a minimal healthy source app, company CRUD and
restart persistence on one Mac. No actual agent or browser interaction,
independent action verification, package installer, Windows first-agent CLI,
concurrent tasks, access-control audit or full network egress capture was
executed. Production privacy certification, B1-B6 and release remain open.
No assertion that all inherited UI/backend package identities are migrated.

**All changes remain private Draft. Main untouched. Actions disabled. NO-GO.**
