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

## Cross-platform rejection and proof-validator checks

At committed candidate source `327f85f3cd3e7c9c1dcdea17a4a1d38696f9012f`, the **same five-test** negative/validation suite ran with real native Windows Node 24 on B144 **5/5 PASS, exit 0**, and real Ubuntu WSL2 Linux Node 22 (using `/usr/bin/node`, not the Windows binary) **5/5 PASS, exit 0**. These tests verify safe no-op/default, publication denial, scrubbed environment, strict real-success/cleanup receipt rules, concurrency overlap truth and macOS memory free percentage parsing. They did **not** launch PostgreSQL on Windows/Linux: the real two-instance database/server test is Mac-only, by explicit platform gate. Native Windows independent postcheck: **0 postgres.exe**, tracked QA checkout clean. Existing B1-53 real Mac and Windows Members UI E2E evidence is unchanged.

## Stronger second real run: simultaneous full Chromium Members + separate API server

Added an **additional** strict `--run-with-browser` Mac-only test mode, without changing the earlier successful API/API mode. It requires a non-symlink owned `$REPO/.qa-playwright-browsers`, actual production `ui/dist/index.html`, at least **50%** available memory per macOS `memory_pressure -Q`, exact packed runtime SHA ownership and precreated safe isolated fixture. Browser worker A runs the real `--run-packed-authz-ui` 47-request three-session Chromium signup / first-admin / Members invitation/promotion/suspension / real PostgreSQL journey. Worker B simultaneously runs `--run-packed-authz` with **another fresh real PostgreSQL cluster and separate packed Bostan server**, independent Better Auth sessions and real tenant/permission isolation. Unlike the API-only run, the A worker is accepted only on its **specific** `BOSTAN_PACKED_SERVER_AUTHENTICATED_CHROMIUM_JOURNEY_QUALIFIED` marker, not the weaker API qualification marker. Both must end clean and have overlapping child lifetimes.

Actual native Mac at exact code SHA `d7a2bef517645fa0bef45cf2487ad7259bd4792a`:
- System-wide memory free **59%** before run, at least 20 GiB available disk. Safely APFS-cloned the pinned browser cache only into B142's own private QA path, never modified B135 or user Chrome.
- Executed **`node scripts/bostan-private-mac-parallel-postgres-authz.mjs --run-with-browser`**: **REAL EXIT 0 in 18.27 seconds**; `BOSTAN_MAC_PARALLEL_BROWSER_MODE=true`, both `WORKER_A_PASS` and `WORKER_B_PASS`, actual overlap true, both clean true, final `BOSTAN_MAC_PARALLEL_REAL_PG_AUTHZ_QUALIFIED`. This combines two isolated real PG clusters and packed Bostan app processes with a full real Chromium Members journey running concurrently alongside an API-only tenant/permission journey.
- Independent read-only postrun checks: **0** owned B142 Node/browser/PostgreSQL processes, **0** owned `bostan-live-http.??????` fixture dirs. Explicitly removed only the verified B142 cloned Chromium test cache after confirming no owned processes. B135 pinned cache untouched, B142 tracked files clean, no unrelated Homebrew PostgreSQL manipulated.
- Focused latest unit suite **6/6 PASS on native Mac**, **6/6 PASS on actual native Windows Node**, **6/6 PASS in native Ubuntu WSL2 Node**, including fail-closed distinct UI/API proof marker and no-op/publication denial. Cross-OS tests did **not** start PostgreSQL outside Mac.

This remains distinct concurrent instances, **NOT concurrent writes to a single shared database**, not native Windows/Linux parallel real PG, and not product release qualification. The entire repo remains PRIVATE, Draft, NONPUBLISHING, ZERO COST; release decision NO-GO.
