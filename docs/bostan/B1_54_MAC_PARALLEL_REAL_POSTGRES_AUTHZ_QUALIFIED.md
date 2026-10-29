# B1-54 — Two genuinely simultaneous Mac PostgreSQL + packed Better Auth journeys

Date: 2026-10-29. STRICT PRIVATE, ZERO-COST, NONPUBLISHING. Exact stacked parent B1-53 Draft #307 head `9c3368ace9fe961379f3cc923aecedfbc2dcfb4d`.

## New executable gate

`scripts/bostan-private-mac-parallel-postgres-authz.mjs` is a **test-only Mac-only explicit opt-in**. No-argument or `--plan` is inert. With `--run`, it first validates native macOS, SHA256-owned prebuilt packed runtime and regular required source files, macOS `memory_pressure -Q` at least **40% system-wide memory free**, and at least 2 GiB free workspace filesystem. It never downloads packages, publishes, deploys, changes protected main, enables Actions, or uses a paid agent/provider.

The gate launches **exactly two** independent instances of the previously qualified `scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz` concurrently. That original harness owns fresh scratch directories, fresh real PostgreSQL clusters and independent application HTTP ports, applies real migrations, launches the SHA-owned packed server, creates synthetic Better Auth accounts and exercises real tenant/permission isolation. Each original harness performs owned cleanup via its `EXIT` trap, stopping only its own server and PostgreSQL, then removing only its marker-owned scratch directory. The new harness **does not share a database** and does not touch unrelated Homebrew PostgreSQL.

The new driver forwards only fixed OS loader/user/temp variables, strips inherited model/provider/cloud/DB secrets and `NODE_OPTIONS`, and never prints child raw stdout/stderr. Its captured outputs are bounded to 512 KiB each; timeout 120 seconds with SIGTERM only to the exact child (a timed-out teardown still fails, requires inspection). A worker qualifies only if it exits zero and has exactly one each of the real packed-runtime ownership, real DB migration, UI/server banner, 2-session authz, packed authz success, and `CLEANUP_COMPLETED exit=0` markers. It explicitly rejects `PG_STOP_FAILED` and unowned-temp warnings. Concurrent qualification requires actual overlapping child lifetimes, not just two sequential green receipts. All failures are reported without secrets.

The macOS `os.freemem()` value was initially seen to be only 0.28 GiB on an 8 GiB Mac while actual `memory_pressure -Q` showed over 50% free due to reclaimable memory. The first admission **REFUSED without starting PostgreSQL**. The fixed gate uses native `memory_pressure -Q` with a bounded, exact one-match parser, with fail-closed invalid/duplicate/unknown tests. It never bypassed low memory arbitrarily.

## Actual Mac execution, not mocks

Authorized native macOS arm64, isolated source at B1-53 exact head `9c3368ace9fe961379f3cc923aecedfbc2dcfb4d`. Existing real 119-chunk SHA256-owned packed runtime, PostgreSQL CLI, all pinned deps. macOS `memory_pressure -Q` showed **52% available**, about **21 GiB disk free**, and there was no B142-owned server/PG process before the test.

Command:
```
node scripts/bostan-private-mac-parallel-postgres-authz.mjs --run
```
**ACTUAL EXIT 0 in 10.87s**, received exactly:
- `BOSTAN_MAC_PARALLEL_WORKER_A_PASS`
- `BOSTAN_MAC_PARALLEL_WORKER_B_PASS`
- `BOSTAN_MAC_PARALLEL_ACTUAL_OVERLAP=true`
- `BOSTAN_MAC_PARALLEL_BOTH_CLEAN=true`
- `BOSTAN_MAC_PARALLEL_REAL_PG_AUTHZ_QUALIFIED`

Both isolated real PostgreSQL+packed Better Auth paths passed and cleaned up independently. Read-only *postrun* scan against the same checker-provided temporary root found **0** `bostan-live-http.??????` scratch directories, **0** B142-owned PostgreSQL/packed-server QA processes, **0** tracked source modifications. The pre-existing unrelated Homebrew PostgreSQL service was never touched. Mac remained about 21 GiB free on the same filesystem.

Focused regression unit suite: **5/5 PASS** covering inert plan, rejected publication, private environment allowlist, exact once-only success/cleanup markers, overlap proof and correct macOS memory-pressure parsing.

## Strict limits

This is genuine **two concurrently running separate PostgreSQL clusters and separate Bostan server instances**; it is *not* two workers concurrently modifying one shared database, nor a high-load stress benchmark. Windows and Linux concurrent real native PG remain unqualified by this Mac-only gate, as do installer packaging, free local offline agent execution, full security/privacy/license/provenance and release. Explicit `releaseQualified:false` is maintained in upstream test receipt. KEEP PRIVATE / DRAFT, NO-GO for release, do not merge main, publish, deploy, pack npm, use real customers or paid inference.
