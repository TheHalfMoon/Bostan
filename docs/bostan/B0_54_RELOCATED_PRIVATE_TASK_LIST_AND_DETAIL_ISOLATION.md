# B0-54 — Real relocated Bostan task-list and task-detail data isolation

**Date:** 2026-10-27. Private stacked Draft above B0-53 (#202, commit `86973c54afc678a789c227e99c448ca69065a73f`). Keep `TheHalfMoon/Bostan` **PRIVATE**; inherited GitHub Actions **DISABLED**, no `main` merge, no publish/deploy, no paid AI/models and no customer data.

## Actual gap closed

B0-53 qualified **nine actual HTTP requests** after relocating the private compiled app: two companies created, company list/detail, one task created in each, and malformed inputs rejected. It checked the `POST` task responses' `companyId` but never queried the **persisted company-scoped issue lists or per-issue GET route**. A 201 creation response can be correct while a subsequent task list cross-contaminates company records or task detail reads fail.

## Source-controlled fix

Expanded the existing `scripts/bostan-private-staged-crud.mjs` *only* in its explicit, local, synthetic test flow. After creating two companies and two tasks, the new assertions:

1. `GET /api/companies/<company-A>/issues` and the same call for B must return HTTP 200 and contain **that company's own task**, with the matching ID, title and `companyId`; **neither may contain a foreign-company task** or any row with a foreign `companyId`.
2. `GET /api/issues/<task-A>` and task B detail must each return HTTP 200 and match the persisted task's ID, company ID and title.
3. Existing invalid empty company name and missing-company route rejection continue unchanged. The request path allowlist extends **only** to these two actual Bostan task-reading API patterns; external hosts remain rejected (`http://127.0.0.1:<high-port>/` only), redirects are forbidden, each request has a finite timeout, and all fixture values are synthetic UUID-tagged data.
4. The receipt reports `issueListReads=2`, `issueDetailReads=2` and `requests=13`, retaining `releaseQualified=false` and `remoteModelCalls=0`.

Extended contract tests to model valid read-list/detail responses and to *actively reject* a simulated company-A list containing a company-B task. Existing fail-closed cross-company creation and untrusted URL tests are preserved. This specifically proves **company record separation under a local implicit admin actor**, and **does not** prove multi-tenant role-based authorization between distinct real identities.

## Executed evidence — real macOS arm64, compiled relocated stage

**`bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated` exited 0**, after frozen offline dependency install and fully compiled Bostan server/React UI, actual `pnpm deploy --prod --offline --ignore-scripts`, repair/verification of the sole generated pnpm self-link, and relocation to a *different invocation-owned directory*. The relocated deployment passed **72/72 direct production dependency closure**, **375 SQL migration assets**, **1,889 internal symlinks and zero external symlinks**, native executable migrations and ephemeral PostgreSQL/HTTP 200 `local_trusted`/`private` bootstrap.

The real Playwright Chromium first paint on the relocated production UI passed (`Bostan` title, `jsErrors=0`, `externalRequests=0`). The subsequent **real 13-request** `bostan.private-staged-crud.v1` receipt reported `companyRecords=2`, `companyDetailReads=2`, `issueRecords=2`, `issueListReads=2`, `issueDetailReads=2`, `invalidInputsRejected=2`, `remoteModelCalls=0`, and `privateLocalhostOnly=true`. The full CLI printed `BOSTAN_PORTABLE_STAGED_COMPANY_TASK_CRUD_PASS`, `BOSTAN_PORTABLE_STAGED_COMPANY_TASK_API_QUALIFIED`, `BOSTAN_PORTABLE_STAGED_BROWSER_FIRST_PAINT_PASS`, `BOSTAN_PRIVATE_STAGED_RELOCATION_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, and `CLEANUP_COMPLETED exit=0` with **no owned staging directories left**. Real PostgreSQL and the app process were stopped, and synthetic QA data deleted. **No model provider was invoked.**

**26/26 Node contract tests passed**, zero failures, zero skips, including 5 standalone CRUD tests. `git diff --check` passed.

### Environment and dependency-cache qualification

The first live run was **blocked before app startup** by a missing `@1password/sdk@0.5.0` tarball in the local pnpm store (offline admission worked correctly). After that was resolved, a later run reached HTTP 200 but could not launch the exact Playwright 1.62.1 Chromium headless shell because its browser cache was empty. We restored the free public registry packages at the **existing frozen lockfile integrity** with lifecycle scripts disabled, and downloaded only the required free Playwright headless browser binary. **These were one-time preparation downloads, not part of Bostan's offline acceptance script**; no paid model or API service was used. The subsequent explicit `--run-relocated` execution used the restored local caches and **passed without on-demand downloads**. No changes to the lockfile or production dependencies were required by B0-54.

## Unqualified release gates

This is synthetic persisted task separation under `local_trusted`/implicit board access, **not** an authenticated cross-tenant RBAC/authorization security test. Updating/archiving tasks, real agent model inference, installation lifecycle on Windows and Linux, native Linux Rust, complete optional feature/peer behavior, independent security and legal review, and signed end-user packaging remain **OPEN**. Release remains **NO-GO**. Do not merge the PR chain or publish.
