# B0-75 — Real native Linux ext4 build, relocated production stage and two-session HTTP qualification

**Date:** 2026-10-28. **Disposition:** implementation qualified in the scoped synthetic local private Linux test; **NOT** an end-user Linux release or overall Bostan release. Private Draft stacked over B0-74 PR #223 (head `02b5479403305b8367581ce8f50bca6a0bd1b01a`). Never merge to `main`, enable GitHub Actions, publish, deploy to public users, invoke paid models, or expose real data without an independent release decision.

## Actual root-cause qualification

The previous DrvFS-backed Ubuntu 26.04 WSL2 runs built Linux TypeScript successfully but the server remained stuck in kernel `p9_client_rpc`. Compiled HTTP qualification failed both at the default 90 health checks and with the opt-in **300 checks**, despite successful real PostgreSQL migrations. Merely waiting longer was not a fix.

A new **native Linux ext4 checkout** was created under `/var/tmp/bostan-b075-native-ext4-qa` at the exact private B0-74 commit `02b5479`, using Git, **not** a Windows-mounted runtime tree. Its initial source clone was ~253 MB. Official Linux Node **24.19.0** executed pnpm **9.12.0**. A frozen-lockfile install completed **1,306** package operations on Linux ext4, using isolated temporary HOME/store and a **QA-only uncommitted Linux x64 glibc architecture filter** to exclude irrelevant OpenCode musl binary variants without removing required TypeScript/Rolldown native binaries. None of the QA architecture changes or dependency stores were committed to Bostan.

The **real native compiled Linux server + PostgreSQL smoke passed** (`BOSTAN_PRIVATE_COMPILED_SERVER_HTTP_ACCEPTANCE_PASS`, `BOSTAN_BUILT_SERVER_LOCAL_HTTP_QUALIFIED`, `MIGRATED`, health HTTP **200**, actual compiled build-stamp commit `02b5479`). Bostan Runner ACPX/schema checks and pinned `linux-x64` Copilot runtime asset verification passed without permission bypasses. Native Vite **8.2.2** compiled the 8,017-module production UI in the same checkout.

An initial full private deploy used a separate test-only pnpm store that lacked cached **registry metadata** required by the pnpm deployment resolver: `ERR_PNPM_NO_OFFLINE_META` for `@agentclientprotocol/claude-agent-acp`. This was not a test failure of HTTP/authorization. A one-time **free public npm registry** metadata warm-up in the isolated QA store completed `pnpm deploy --prod --ignore-scripts` with **exit 0** and removed its own test-only stage. No paid packages, remote inference or lockfile mutation.

### Independently retaken real private production stage

The new, opt-in, default-inert, read-only-source-admitted `scripts/bostan-private-linux-native-prebuilt-stage-authz.sh` was run from the **already compiled native Linux ext4 checkout**, with all online fetches explicitly off for the actual acceptance, and deployed into owned fresh **Linux tmpfs `/tmp`**, not DrvFS. The stage was verified by the existing production staging checker (full internal-only symlink traversal + production manifest dependency closure, 375 SQL migrations, 72 production dependencies, pinned ACP SDK 0.129.0). The font/legal stage gate preserved three staged board fonts and three legal files byte-for-byte. Its result:

- `BOSTAN_LINUX_NATIVE_TMPFS_STAGE_VERIFIED`: **375** SQL migrations, **1,902** internal symlinks, **zero** foreign symlinks, 72 production deps, real UI included, source copyright notices preserved.
- `MIGRATED` followed by actual compiled `/api/health`: **HTTP 200**, `health=ok`, `deploymentMode=authenticated`, `exposure=private`, `bootstrapStatus=bootstrap_pending`.
- `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`: **40** synthetic actual authenticated HTTP requests, **two independent sessions** and memberships, cross-tenant list/detail/write denials, matching foreign task 404 behavior, viewer cannot write, revoked membership denial, invitation creation+acceptance, unauthorized promotion denial, successful operator promotion, suspension denials. **Zero model/provider calls.**
- `BOSTAN_PORTABLE_STAGED_AUTHENTICATED_TWO_SESSION_QUALIFIED`
- `CLEANUP_COMPLETED exit=0`, `BOSTAN_LINUX_NATIVE_STAGED_POSTGRES_AUTHZ_PASS`, `BOSTAN_LINUX_NATIVE_QA_CLEANUP exit=0`, `B075_REAL_LINUX_NATIVE_TMPFS_AUTHZ_ACCEPTANCE_PASS`, overall **exit 0** (~114 seconds for final prebuilt stage).
- Actual test used only throwaway localhost PostgreSQL and `.invalid` synthetic identities. No customer data, cloud inference, public deployment or end-user installer.

### New first-party test runner and tests

The committed B0-75 script is a standalone repeatable QA gate. By default it prints a plan and changes nothing. Explicit `--run-authz` requires Linux, explicit `BOSTAN_LINUX_PRIVATE_TMPFS_QA=1`, a real tmpfs and >=3.5 GiB stage/5 GiB MemAvailable, >=4 GiB source free, Linux glibc native dependency closure, font/legal source compliance, complete native compiled output, same-source compiled build-stamp ancestry and no product source diff. It verifies the pinned runner vendor assets, compiles real Vite UI, deploys a fresh owned Bostan production stage in canonical tmpfs, audits dependencies/symlinks/fonts, then runs real PostgreSQL+HTTP two-session authz. Only the verified owned temp stage is removed; no user HOME or unrelated paths.

**15/15 focused Mac ARM64 source/safety tests passed** (new runner + native dependency + resource gates), shell syntax and tracked diff checks passed. The required Linux runtime evidence above is separate and superior to static Mac tests.

## Scope and remaining gates

This confirms **Linux x64 glibc native ext4 private compiled app, PostgreSQL, staged UI integrity, authenticated backend HTTP and two-user tenant isolation**. It **does not** establish a packaged end-user Linux installer, Linux Chromium GUI/native desktop walkthrough, native Windows production runtime/installation, real free-model agent end-to-end execution, all threat-model/security cases, or the complete dependency licensing audit. The repo remains **PRIVATE**, Actions OFF; all stacked work remains **Draft/unmerged**. **Bostan overall release = NO-GO.**
