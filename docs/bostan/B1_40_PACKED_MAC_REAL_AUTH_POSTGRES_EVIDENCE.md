# B1-40 — Actual SHA-owned packed runtime + real Mac Better Auth/PostgreSQL acceptance

Date: 2026-10-29. PRIVATE, ZERO-COST, strictly NONPUBLISHING. Parent is B1-39 Draft PR #292 head `e08cc49c315b9d08ba884f7dc7609991ff8ba03f`. No merge to `main`, Actions activation, deploy, publication, release, npm pack or customer records.

## Product gap and narrow test-harness change

Previous Mac B1-38 executed `server/dist/index.js` built from TypeScript plus ephemeral PostgreSQL/Better Auth and qualified 43 real HTTP requests. A separate Mac B1-36 smoke booted the SHA-owned esbuild-packed `server/dist-runtime/index.mjs` to HTTP health, but **neither** proved authenticated API behavior through the independent packed runtime. Native Windows packed runtime had hung for 180 seconds, so this distinction mattered.

Extended the **existing** `scripts/bostan-local-http-postgres-smoke.sh` with explicit `--run-packed-authz` (not default). Admission requires:

1. Real, pre-existing `server/dist/index.js`, `server/dist/build-info.json`, and vendor Runner JavaScript; no fallback to the source TypeScript loader.
2. **Before any temporary DB creation**, call unchanged production `assertSafeRuntimeOutdir(server/dist/index.js,server/dist-runtime)` on the exact **SHA256-owned** compiled chunks/manifest. Fail closed if missing, modified, linked, foreign, or wrong source.
3. Run `node server/dist-runtime/index.mjs` directly, without TSX, under the same strictly private `127.0.0.1` origin, ephemeral isolated PostgreSQL cluster, migrated DB, random Better Auth secret, disabled external provider variables and telemetry, synthetic owner marker and owned process teardown used by the established B1-38 test.
4. Run the existing 43-request, two-session real Better Auth authorization suite including anonymous first-admin 401, signed-in first-admin 200, second-user claim 409, tenant issue/invite/promotion/suspension denials and isolation. **Never** insert an initial admin row directly for this new mode.
5. Emit exact unique `BOSTAN_PACKED_SERVER_AUTHENTICATED_TWO_SESSION_QUALIFIED` only if all authz requests pass. Continue to register cleanup on success or failure; do not release a server child or PG cluster.

Only the local qualification harness changed. No Bostan application source, auth logic, UI, database schema, runtime bundler or actual packed chunks were changed.

## Actually executed — authorized native Mac

Mac private isolated checkout `~/Bostan-B135-qa` at **exact QA code head `69f11f0edd852c5e71aec833af83a53d7e4fb535`**, Node v26, pnpm and local PostgreSQL tools installed.

- `bash -n scripts/bostan-local-http-postgres-smoke.sh` **EXIT 0** and `--help` lists the opt-in new mode.
- Independently executed unchanged production `assertSafeRuntimeOutdir` on the prebuilt Mac `server/dist-runtime`: **`ACTUAL_MAC_PACKED_SHA256_ADMISSION=PASS`**; file ownership remains exact and code unchanged.
- Actual `DO_NOT_TRACK=1 OTEL_SDK_DISABLED=true BOSTAN_FEEDBACK_EXPORT_ENABLED=0 bash scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz` with model/API/provider secrets unset: **EXIT 0** in **9.70s** from host wrapper.
- Output `BOSTAN_PRIVATE_LOCAL_CLOUD_ISOLATION_ADMITTED`, `BOSTAN_PACKED_SHA256_RUNTIME_OWNERSHIP_VERIFIED`, `MIGRATED`, private authenticated `/api/health` returned **HTTP 200** and `bootstrap_pending`, `BOSTAN_BOOT_BANNER_QUALIFIED`.
- Real authenticated 2-session tenant suite: `passed:true`, **43 real HTTP requests**, 2 signed-in identities, exact actual first-admin claim (anonymous denied / first allowed / second denied), role and membership checks, foreign task same result as nonexistent task, cross-company list/write denials, invite accepted, viewer denied writes, promotion granted writes, same-session suspension denials. **`providerCalls:0`** and no inherited cloud config.
- Exact `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS` and **`BOSTAN_PACKED_SERVER_AUTHENTICATED_TWO_SESSION_QUALIFIED`**, followed by `CLEANUP_COMPLETED exit=0`.
- Additional independent Mac read-only postrun scan: **0 residual owned PostgreSQL processes**, **0 packed server processes**, clean tracked Git worktree, ~17GiB free disk and ~61% free memory.

**Qualification scope:** This test uses the *previously built* genuine Mac packed esbuild runtime from B1-36; only the test harness has changed since it was built. It is therefore a real packed runtime + real DB/authenticated HTTP run, **not** proof of rebuilding full source/semantic typecheck on current branch or of Windows product behavior. No Chromium/playwright UI or local AI agent was executed.

## Remaining NO-GO

Native Windows has correctly generated the same 238-file SHA256-owned packed runtime, but its full private `--run-compiled` PostgreSQL/HTTP harness **still fails after 180 seconds/178 probes without health**. Owner PostgreSQL shutdown in that failed suite was uncertain, and retained scratch files must not be deleted without proved ownership and stopped-cluster checks; read-only later scan found 0 active PostgreSQL processes but does NOT prove successful original cleanup. B1-39 introduced secret-free pre-import stage probe; this must diagnose Windows startup before any risky repeated 180s E2E.

Still open: native Windows issue #237 complete 18-stage private Better Auth bootstrap, cross-suite PG orphan #234, Chromium first-admin browser UI and accessibility/UX, genuine no-cost local agent execution, installation/OS support on Windows/Linux/Mac, privacy/security/NOTICE/licenses and full semantic typechecks. **Release NO-GO**.
