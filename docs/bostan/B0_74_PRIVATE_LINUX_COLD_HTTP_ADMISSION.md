# B0-74 — Bounded Linux compiled server cold-start HTTP diagnosis

**2026-10-28.** Private stacked Draft based on B0-73 PR #222 (head `379f157`). Keep repository **PRIVATE**, GitHub Actions **OFF**, no `main` merge, release, deployment, paid AI or customer data.

## Observed gap

B0-73 built the actual Linux x64 Bostan runner, verified its pinned Copilot runtime assets on an ephemeral DrvFS `metadata` QA mount without bypassing the pinned executable permissions or hashes, compiled all required local adapters and the server, **migrated the actual disposable PostgreSQL 18 database**, but the compiled HTTP readiness probe ended `HEALTH_FAILED status=0`. The Node process remained alive; the server emitted no startup logs before the original 90 probes expired. Inspection found the process blocked in Linux `p9_client_rpc` while importing its dependency graph from the Windows-backed DrvFS volume. This is an I/O and qualification environment bottleneck, not evidence of successful HTTP or release readiness.

A separate **reused precompiled server** execution `--run-dist`, without repeating the heavy TypeScript builds, independently reproduced the outcome: `MIGRATED`, `HEALTH_FAILED status=0`, cleanup `exit=1`. Real PostgreSQL startup and migrations were successful in both attempts. The original 90-attempt limit is not a Linux-native security requirement and can hide slow filesystem cold imports.

## Source changes

`scripts/bostan-local-http-postgres-smoke.sh` keeps its **existing 90 health attempts by default**. An extension to at most **300 bounded readiness attempts** is allowed **only** for explicitly opted-in, precompiled `--run-dist` on Linux with both `BOSTAN_LINUX_PRIVATE_COLD_BOOT_QA=1` and `BOSTAN_LINUX_PRIVATE_TMPFS_QA=1`. Before admitting it, the already reviewed read-only tmpfs admission re-verifies canonical Linux `/tmp`, actual tmpfs filesystem type, >=3.5 GiB staging space and >=5 GiB available memory. Every HTTP response must still be actual private loopback, JSON health status OK, correct deployment mode and expected bootstrap state. This extension **does not** relax DB/auth/routing checks or extend end-user Windows, Mac, or deployed application modes. It does not use a cloud model.

Log markers at every 30th unsuccessful probe report only the number of attempts and whether the child process remains alive. Failures report the bounded attempt count and whether a local synthetic server log was empty, followed by the existing bounded local log tail if nonempty. User passwords, API tokens and full environment values are not intentionally emitted. This is an observability aid and does **not** claim readiness when the server remains silent.

## Real evidence

- Mac arm64, exact B0-74 code: focused HTTP entrypoint and Linux resource tests **8/8 passed** (no fail or skip). Source syntax / whitespace checks passed.
- First Mac offline full-app execution initially could not proceed because the **local pnpm package store** was missing public `@1password/sdk@0.5.0` tarball (not an app test failure). A frozen-lockfile, ignore-scripts dependency refresh via the free public npm registry completed **exit 0**, preserving package versions and lockfile.
- Retaken real private Mac full compiled-server + Vite UI + offline deployed/relocated application + PostgreSQL + private HTTP **200** + two signed-in synthetic users **PASSED**: 40 HTTP authorization and tenant-isolation requests, invite acceptance/denials, suspension, viewer role controls, company boundary checks, zero remote provider calls. Verified UI bundled 3 pinned fonts and 3 legal notice/license files. Markers: `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, `CLEANUP_COMPLETED exit=0`. Total command **exit 0**.
- Ubuntu 26.04 WSL2 x86_64, Node 24.19, native PostgreSQL 18: existing 90-attempt source mode **FAILED** health after compiled server was verified, database migrated and process remained alive. The process was observed waiting in kernel `p9_client_rpc`. No Linux production HTTP success was inferred from these results.
- **Actual bounded Linux retake completed with a negative result:** the real tmpfs resource gate admitted the explicit 300-attempt mode; the same actual compiled Linux Node process remained alive through `BOSTAN_HTTP_BOOT_PENDING attempt=300/300 process_alive=1` but **never served the required private `/api/health`**. Exact terminal markers: `HEALTH_FAILED status=0 attempts=300`, `BOSTAN_HTTP_STARTUP_DIAGNOSTIC_LOG_EMPTY`, `CLEANUP_COMPLETED exit=1`, `B074_QA_TRANSIENT_MOUNT_CLEANUP exit=1`, `B074_EXTENDED_LINUX_HTTP_EXIT=1`. No pass was claimed. The process was independently observed in kernel `p9_client_rpc`. This establishes that simply increasing the timeout does not qualify Bostan on the Windows-backed WSL mount. The next investigation isolates the actual compiled production stage on native Linux `/tmp`.

## Boundaries

This is a QA-only observability and bounded cold-start change. It does not optimize P9-mounted Linux source resolution; true native ext4 Linux packaging and private end-user Linux server+UI+agent runner, Windows end-user app, free-model agent completion, complete third-party license inventory and independent security/release review remain OPEN. **Bostan release decision NO-GO. Keep PR Draft/unmerged.**
