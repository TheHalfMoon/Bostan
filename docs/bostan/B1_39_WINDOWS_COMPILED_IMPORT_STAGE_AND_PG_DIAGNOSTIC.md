# B1-39 — Native Windows packed runtime startup-stage diagnostics

Date: 2026-10-29. Bostan private, nonpublishing, zero-cost. Exact stacked parent B1-38 Draft PR #291 head `cc438b648e7ffc6afa90323ce1c404412ca7a597`. Do not publish, merge protected main, enable Actions, npm pack, deploy, use real user data, terminate foreign processes or delete unknown files.

## Genuine underlying Windows issue; do not misreport as fixed

The B1-38 native Windows isolated `D:\\Bostan-B135-qa` at exact B1-38 head had a successful *test-only* TypeScript `--noCheck` emit with `NODE_OPTIONS=--max-old-space-size=1536` (EXIT 0), successful copy of runtime assets/build stamp, and successful native pinned esbuild compile of **2366 inputs → 119 chunks in 36,841ms**. Production `assertSafeRuntimeOutdir` independently verified **238 SHA256-owned files**, including `server/dist-runtime/index.mjs` (EXIT 0). This is **not** full TypeScript semantic typecheck/release qualification.

The native Windows `--run-compiled` E2E test uses a repository-scoped `tsx` preload **only to import the embedded PG TypeScript test helper**, never to run the packed server. Exact standalone loader `node --import ./server/node_modules/tsx/dist/loader.mjs` imported the helper (EXIT 0). Actual fresh isolated embedded PostgreSQL migrated (`BOSTAN_WINDOWS_LIVE_POSTGRES_MIGRATED`), and the exact SHA-owned compiled server child started (`BOSTAN_WINDOWS_LIVE_SERVER_MODE=compiled`), but did not produce an authenticated `/api/health` response within the **180-second monotonic deadline**; health outcome `deadline_exceeded`, **178 probes**, `no_response`, stage `not_observed` because the packed bundle did not emit any pre-entry stages. **Real authenticated HTTP 18-stage qualification FAILED, exit 1**. In particular no signup, cookies, admin claim, or browser were qualified on native Windows.

Teardown: the specifically owned app child closed; `db.cleanup()` failed, so the harness correctly did not prove `POSTGRES_CLEANED`, did not run the final process-tree orphan checker and did not delete uncertain owned fixtures. Read-only Windows inspection showed **zero postgres.exe and zero Bostan-owned Node QA processes after the failure**, which is not equivalent to the suite's required formal cleanup gate. The failed fixture left an owned PostgreSQL scratch directory with a `postmaster.pid` file. An independent **READ-ONLY** check on that same exact test cluster with the pinned `pg_ctl.exe -D <owned cluster> status` returned **exit 3 (server not running)** while `postgres.exe` count was zero and the PID marker remained. This supports the diagnosis of a stale PID marker after an unsuccessful stop, **not proof that the old directory is safe to recursively delete**. No files have been deleted and no unowned process was killed. Some reserved scratch directories under `D:\\Bostan-B135-temp` remain intentionally for controlled follow-up. Space on D stayed around 9.32 GiB at last read-only check.

## New B1-39 diagnostic instrumentation (test-only)

The existing compiled-mode QA selector already validates every runtime file against its SHA256 ownership manifest and inserts the Windows synthetic entry guard as first `--import`. The new second `--import` is `scripts/bostan-private-windows-compiled-startup-probe.mjs`, which:

1. Does nothing on non-Windows or when the **exact preexisting** `BOSTAN_PRIVATE_QA_ENTRY=B087_TEST_ONLY` is missing (no override or bypass of the first admission guard).
2. Emits only the constant `BOSTAN_WIN_SERVER_STAGE=static_import_start` after successful guard admission, **before** the static import of the packed app.
3. Emits only the bounded constant `BOSTAN_WIN_SERVER_STAGE=static_import_pending` every 30 seconds while the event loop runs; the interval is `unref()` so it cannot keep a stopped child alive.
4. The parent private HTTP QA's existing **safe-value-only** diagnostic parser now recognizes `static_import_pending` as an allowable terminal stage. It still never prints raw app stderr, shell paths, model keys, DSNs, cookies or user credentials.

New isolated Node tests on **native Windows Node24** and **native Mac Node26**:

| Gate | Windows | Mac |
|---|---:|---:|
| startup probe platform/marker gating and safe constant output | PASS | PASS |
| actual guarded native Windows child: valid owned QA marker emits only after guard; corrupted marker refuses before any stage | PASS | SKIP (platform-dependent by design) |
| existing compiled-runtime command/admission/regression suite (including rejection of unmarked, changed or symlinked chunks) | PASS except native file symlink privilege SKIP | PASS |
| **Combined `node --test scripts/bostan-private-windows-compiled-startup-probe.test.mjs scripts/bostan-private-windows-server-command.test.mjs`** | **13 PASS, 0 FAIL, 1 SKIP, EXIT 0** | **13 PASS, 0 FAIL, 1 SKIP, EXIT 0** |

Final tested source commit `ae12c2e1b7f9efaf5ef59b8f1c164f791cd58552`. Windows D had ~9.32 GiB after tests, RAM ~4.98 GiB, no heavy PG or TypeScript compile needed; Mac remained ~16 GiB free. No production server behavioral change and no fresh native 180-second PG/HTTP run after this patch; the actual full product gate remains **RED**.

## Next objective gates

Run next private native Windows 180s end-to-end only after safe free disk/RAM and a verified orphan-PG/owned-fixture recovery policy, then inspect first/last reported safe static import stages to distinguish ESM module load from runtime startup. Fix actual observed blocker, require full PG/BETTER AUTH/HTTP/first-admin/tenant end-to-end + formal cleanup, cross-suite PG orphan proof (#234), actual Chromium and first free genuine offline agent. Mac B1-38 already passed real 43-request authenticated Better Auth/PG API claim on `server/dist/index.js`, but **not** packed authenticated runtime or real browser UI. Keep release **NO-GO**.