# B0-80 — Fail-closed local QA isolation from upstream managed Cloud configuration

**2026-10-28**. Private stacked Draft on B0-79 PR #228 (`270e71d276742315ad9b090fe45271b80dbcc5c1`). Bostan remains PRIVATE, GitHub Actions OFF; no merge main, release, publishing, cloud deployment, paid model inference or real customer data.

## Grounded risk / limitation

The legacy Paperclip Cloud mode is not the default for a self-hosted Bostan server. The actual cloud predicate in `server/src/services/cloud-instance.ts` is **false** unless `PAPERCLIP_CLOUD_TENANT_SERVER_TOKEN` is populated or `PAPERCLIP_MANAGED_CONFIG` is **present** (even if empty). Genuine self-hosted health omits the `cloud` block. Therefore, a private QA acceptance must not accidentally inherit those signals and then falsely qualify an upstream-managed runtime as local. The `PAPERCLIP_CLOUD_API_ORIGIN` and other `PAPERCLIP_CLOUD_*` environment variables also indicate a distinct external control plane and should be forbidden for synthetic local-only acceptance.

## Changes (QA only)

- Added **read-only default-inert** `scripts/bostan-private-local-cloud-isolation.mjs`. Explicit `--check` refuses any defined `PAPERCLIP_CLOUD_*`, `PAPERCLIP_MANAGED_CONFIG`, `PAPERCLIP_PRIMARY_HOST` or `BOSTAN_CLOUD_*` variable, including empty values. It reports offending **variable names only**, never token values. It does not modify the environment, query a provider or touch production services.
- Added the required check to `scripts/bostan-local-http-postgres-smoke.sh` **before stage verification, temporary PostgreSQL cluster creation or network activity**; the private smoke retains its exact localhost DB, synthetic identities, 512 MiB temp-space admission, authentication controls, stage cleanup and zero paid models.
- Strengthened the actual private localhost `/api/health` assertion to require the absence of any `cloud` property. Added `externalCloudConfigured:false` only in the emitted synthetic QA receipt. No production server response, Cloud support, Cloud deployment metadata, auth behavior or environment setting was modified.
- Added 3 native CLI/guard tests plus actual shell refusal test, including a matrix of **7 forbidden names × empty or fixture-secret values** and checks that the values never appear in stderr. Structural private HTTP smoke tests extended.

## Verification evidence

- Mac ARM64 Node26: focused **6/6** test suite PASS, zero failures/skips. Includes 7 forbidden env-key variants (empty/secret fixture values) and a direct actual `bash scripts/bostan-local-http-postgres-smoke.sh --run` refusal **exit 2** before any migration/PG startup. Shell syntax and source `git diff --check` passed.
- **Actual compiled private Mac server + Vite UI + relocated stage + PostgreSQL + two authenticated sessions + 40-HTTP tenant isolation** retaken on B0-80 source: **PASS exit 0** (~93 sec). Verified `BOSTAN_PRIVATE_LOCAL_CLOUD_ISOLATION_ADMITTED` (before stage/DB), real `MIGRATED`, health **HTTP 200** with `externalCloudConfigured:false`, real two synthetic sessions **40/40 authenticated HTTP requests**, `providerCalls:0`, `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, and `CLEANUP_COMPLETED exit=0`.
- Source-based proof cannot establish that a fully deployed cloud tenant will not contact its configured cloud control plane; this **is not** a production cloud-disable feature. It is explicit local QA isolation evidence.

## Remaining blockers

Real free-model agent task completion, complete independent dependency license/security audit, externally backed Paperclip Cloud reimplementation, native Windows end-user release qualification and native Linux desktop/installer remain OPEN. Overall Bostan release **NO-GO** and all stacked PRs remain Draft/unmerged.
