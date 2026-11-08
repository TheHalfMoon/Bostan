# B1-61 — Fail closed on pre-existing foreign issues in shared-DB readback

Date: 2026-10-30. PRIVATE, ZERO-COST, NONPUBLISHING. Exact parent: B1-60 Draft #314 at `44eb063b59528fdcda10d65b9f5a6974a31886ab`.

## Actual source-backed defect

The B1-60 synthetic-only shared PostgreSQL Chromium helper verified all twelve newly created issue IDs and rejected leakage of the six newly created IDs from the other company. However, it did **not** reject an unrelated, already-existing foreign-company issue returned in a company-scoped GET. The helper could therefore return `twoCompanyReadback:true` even when the response contained a pre-existing cross-company record, or an unscoped row missing `companyId`.

This is a **test-qualification false positive**, not evidence that the real server leaks records. The stronger Windows combined E2E in B1-60 remains RED before HTTP readiness.

## Repair and executed evidence

Require **every returned issue row** from each company-scoped readback to have the exact expected `companyId`. Preserve all existing twelve-ID, uniqueness, overlap, persisted-readback, cross-company denial, session and opt-in requirements. Do not print raw issue data, cookies or paths.

- Actual original B1-60 source and new pre-existing-foreign/unscoped regression: native macOS Node 26 **RED 3 PASS / 1 FAIL**, failure `Missing expected rejection`.
- Patched exact-source native macOS Node 26 focused suites: **GREEN 10/10 PASS**, zero failures/skips, including original Windows browser opt-in gates and shared-DB helper tests.
- `node --check` for changed source and tests: PASS.
- Independent initial single-case RED: **0/1 PASS**, followed by patched source **4/4 PASS** (3 inherited + 1 foreign-leak regression).
- This run uses synthetic, in-memory owned fixtures only. No live Windows PostgreSQL/Chromium execution, no user data, no external models, no cloud, no disk cleanup or unrelated process termination.

## Still not qualified

Native Windows B1-60 real packed server startup still fails the 180-second health deadline before Chromium/Better Auth/concurrent writes. Mac real shared-DB test from B1-56 does not substitute for the combined Windows mode. Linux native runtime/installer, multi-suite PostgreSQL orphan evidence, broader security/privacy/license/NOTICE/provenance and agent sandbox remain release **NO-GO**.

No main merge, Actions enablement, deployment, npm pack/publish, release, paid inference or human-review dependency.
