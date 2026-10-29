# B1-56 — Real simultaneous authenticated writes to ONE disposable PostgreSQL database

Date: 2026-10-29. STRICT PRIVATE, ZERO-COST, NONPUBLISHING. Exact stacked parent B1-55 Draft PR #309 HEAD `cfe4506a61ae3900d5704237f2120dba73faab31`.

## Engineering: an exact opt-in new test mode

Added `--run-packed-authz-concurrent` to the existing `scripts/bostan-local-http-postgres-smoke.sh`. This is explicitly different from B1-54, which ran two independent PostgreSQL clusters in parallel. The new mode runs the **same prebuilt SHA256-owned packed Bostan server and a single fresh migrated real disposable PostgreSQL cluster** with the existing two-user/tenant authenticated API QA. The existing private localhost, isolated TEMP ownership, memory/disk, role/bootstrap, cloud secret removal, migration, real Better Auth and owned shutdown requirements remain unchanged.

The inherited `BOSTAN_AUTHZ_SHARED_DB_CONCURRENT` environment flag is **unconditionally unset** before any test mode and only becomes `1` inside the new dedicated opt-in. Default `--run-packed-authz`, `--run-packed-authz-ui`, built/deployed and source smoke modes are not expanded or weakened. Unknown/multiple command modes fail before any database scratch setup.

Once the original authenticated synthetic company memberships, invite role transitions, cross-tenant denials and Bostan task readbacks are confirmed, `scripts/bostan-private-staged-authz-e2e.mjs` launches **12 concurrently dispatched actual authenticated HTTP issue POST requests**, with 6 writes into each of two companies belonging to different authenticated users in the **same real PostgreSQL database**. Every returned issue must have a distinct valid UUID and the correct company ID; actual request intervals must overlap (`max(start)<min(end)`). After all writes finish, real company-scoped issue GET readbacks must include all six newly created owned issues with zero IDs leaked across the other company's response. At the same time, two forbidden cross-company/suspended-user writes must actually return HTTP **403**. No direct SQL seeding of these 12 tasks, model inference, external provider or customer data.

A success receipt includes only `sameRealDatabase:true`, `concurrentWrites:12`, `distinctIssueIds:12`, `actualHttpOverlap:true`, `twoCompanyReadbacksPassed:true`, `concurrentForbiddenWritesDenied:2`. Anything else fails before the shell's final `BOSTAN_PACKED_SHARED_POSTGRES_CONCURRENT_WRITES_QUALIFIED` marker. Existing original multi-session and clean teardown markers remain required. This is a functional concurrency + isolation check, **not** a high-load benchmark or formal serializability proof.

## Actual native Mac test runs — GREEN

Authorized native Mac B142, preexisting SHA256-owned packed runtime and dependencies, no model. Commands were executed with **`env -i`**, fixed OS loader variables, isolated temporary HOME, tracing disabled, local PostgreSQL and no account/provider credentials. Full worker stdout/stderr stayed inside a tightly scoped owned temp log folder; user-visible logs contained only fixed allowlisted success markers and booleans, then the owned log folder was removed on success.

1. At source commit `52cb08ef44716573c6efe2bfe63e73fcfb2f64b1`, actual `bash scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz-concurrent` **EXIT 0 in 14.11 seconds**. Pinned SHA256 runtime admission, real fresh PG migration, full original authenticated two-session authorization, 12 actual overlapping writes, same-DB scoped persistence readback, two denied unauthorized writes and full owned PG/server/fixture teardown all PASS.
2. The test-only authz helper had a privacy weakness: on unexpected HTTP status it included a dynamic path (potentially including a one-time invite token) in the thrown message, and an invalid-JSON response might leak raw data through a parser exception. Replaced errors with only a bounded fixed route category, method and status/expected codes; never echoes raw URLs, generated UUIDs, invite tokens or response bodies. Added regressions for token-injected path, hostile route, invalid status and malformed JSON. No production server/model/data changes.
3. **Re-executed the entire real same-DB test** on committed post-hardening source `c91dccd1056fc6b965d58fbc5c52c6e55c1efba7`: **EXIT 0 in 13.91 seconds**, with all same SHA-owned/migration/authorization/concurrent writes/forbidden writes/readbacks/cleanup indicators true.
4. Separate independent postrun Mac scan: **0** exact `bostan-live-http.??????` fixture directories, **0** B142-owned app/PostgreSQL processes; B142 tracked source clean. No unrelated PostgreSQL or user apps touched.

## Cross-platform bounded gate checks

New `scripts/bostan-private-shared-postgres-concurrency-gate.test.mjs` plus extended authz unit tests check explicit-only mode (no inherited flag), command refusal without exact opt-in, source-level real-client overlap/readback/denial assertions, disposable DB sentinel, rejected public/foreign database URL, and error-message redaction.

- **Native macOS Node:** **6/6 PASS**, zero skips, including actual Bash CLI no-op/refusal tests.
- **Native Windows Node 24:** **6/6 PASS**, zero skips. Its Bash runtime would translate to WSL and reject a `D:\\` path, so this test uses static source contract checks only on Windows, rather than claiming direct Windows Unix Bash support. The original Windows packed PG/Chromium real authenticated E2E remains separately qualified by B1-53.
- **Native Ubuntu Linux WSL2 Node 22:** **6/6 PASS**, zero skips, including actual Linux Bash CLI no-op/refusal tests. This does **not** launch Linux PostgreSQL or validate Linux application packaging.

## Remaining NO-GO

The functional 12-request same-DB concurrency and two independent-Mac-instance tests are now GREEN for these exact source versions. Outstanding: sustained high-load/shared-row contention/deadlocks/transaction isolation benchmarks, native Windows and Linux concurrent real DB execution, complete autonomous governed company/CEO-specialist workflow under realistic tasks, untrusted model sandbox/effect consent and budgets, cross-platform installer and Linux runtime qualification, independent security/privacy/license/NOTICE/provenance/branding audit, and release acceptance. Release **NO-GO**; repo PRIVATE, stacked Draft, no protected main merge, package publishing, deploy, Actions activation, paid model or customer data.
