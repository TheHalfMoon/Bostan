# B0-53 — Real synthetic company and task API qualification on relocated private app

**Date:** 2026-10-27. Private stacked Draft based on B0-52 (#201, `324d721ade39aa98d75b694104d49470c96df798`). The repository remains **PRIVATE**, inherited GitHub Actions disabled, no `main` merge, no release/publication, no paid models and no user-data mutations.

## Gap addressed

B0-52 established a compiled Bostan server and production Vite UI that could boot from a newly relocated production stage, on disposable localhost PostgreSQL with a real Chromium first paint. **Opening the UI and passing `/api/health` did not prove the main application could persist a company or a task through the deployed API.** A healthy HTML response can coexist with broken create/list/detail routes or a mismatch between a company's tasks and the company ID used by its client.

## New explicit executable acceptance

Added `scripts/bostan-private-staged-crud.mjs` with read-only default `--plan` and explicit `--run --url http://127.0.0.1:<port>/`. It fails closed for remote hosts, TLS/credentials, other paths, query strings or ports below 1024. It only uses `fetch` for bounded localhost requests, with `redirect:error`, no-cache and a 12-second timeout. All payload names are unique **synthetic-only** markers.

On a running disposable local Bostan API, the script performs nine *actual HTTP JSON calls*: create two companies (expect 201 + distinct IDs), read each company and verify its exact name (200), list companies and verify both IDs are present (200), create one task in each company and assert returned IDs, company IDs and task titles correspond to the correct company (201), then verify the API rejects a company with an empty name (400/422) and the malformed missing-company task list route (400 with an error). No agent is ever activated, no external model is invoked and all records are in the disposable PostgreSQL database owned by the existing smoke-test cleanup.

The existing `scripts/bostan-local-http-postgres-smoke.sh --run-deployed` now supports optional `BOSTAN_STAGE_CRUD_E2E=1` to run the synthetic API against the *actual staged server*, not a source-only/TSX stub. The full-app staging acceptance sets this opt-in explicitly alongside real Chromium. Thus `bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated` checks staging/relocation, real compiled database migrations, browser first paint, **and** company/task HTTP API before deleting the temporary stage and database. Previously qualified source-mode behavior, private model restrictions, release NO-GO and trusted temp-root rules remain unchanged.

## Executed evidence on authorized macOS

**One-command relocated full-app acceptance finished with exit code 0**, from clean source build through real offline pnpm deployment and moving the stage to a second path. The actual `bostan.private-staged-crud.v1` receipt reported:

- `companyRecords=2`, `companyDetailReads=2`, `issueRecords=2`
- `invalidInputsRejected=2`, `requests=9`, `remoteModelCalls=0`
- `qualified=true`, `releaseQualified=false`, `privateLocalhostOnly=true`

Real markers: `BOSTAN_PORTABLE_STAGED_COMPANY_TASK_CRUD_PASS`, `BOSTAN_PORTABLE_STAGED_COMPANY_TASK_API_QUALIFIED`, `BOSTAN_PORTABLE_STAGED_BROWSER_FIRST_PAINT_PASS`, `BOSTAN_PRIVATE_STAGED_RELOCATION_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, and `CLEANUP_COMPLETED exit=0`. The health endpoint returned HTTP 200 and the Chromium UI had **zero JS errors and zero attempted external requests**. No leftover owned `bostan-staged-server-*` directories or persistent Bostan QA database remain.

Source-level tests include strict local URL admission, successful simulated CRUD transitions, rejection of a task assigned to the wrong company, and safe no-op/default CLI. These are *additional negative contract tests*; the real localhost Postgres API test above is the substantive qualification.

## Remaining independent release gates

This is a **local-trusted, disposable, synthetic CRUD flow**, not a multi-user permissions audit. It does not qualify real agent models, task scheduling or payments, user authentication under network exposure, installed Windows or Linux app, native Rust packaging, entire optional/transitive dependency closure, or independent security/legal review. Those release gates remain **OPEN**; Bostan remains **NO-GO**. No publication, release or `main` merge occurred.
