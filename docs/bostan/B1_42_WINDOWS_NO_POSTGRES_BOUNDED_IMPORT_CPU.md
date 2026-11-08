# B1-42 — Bounded native Windows SHA-owned packed import profile, NO PostgreSQL

Date: 2026-10-29. PRIVATE, ZERO-COST, NONPUBLISHING. Exact parent B1-41 Draft #294 head `3b60e9850ec0c001f340ff5b27b9c1a9dbb8e5a4`. No main merge, publishing, GitHub Actions, npm pack, paid model/compute or real customer records.

## Why this probe exists

The actual Windows full private HTTP/PG/Better Auth test **failed** after 180s/178 health probes even though native esbuild packed all 2366 inputs/119 chunks and a SHA256 manifest verified 238 generated files. Its old stderr stage was `not_observed`. B1-39 added a synthetic-only preloader that emits `static_import_start` before ESM import and `static_import_pending` after 30s only if the event loop can run. A first bounded **manual** 36-second no-PG run showed `static_import_start` but **no pending**. This narrows the failure to early module evaluation/blocking, but is not a precise identified function.

## New reusable strict diagnostic

`scripts/bostan-private-windows-packed-import-probe.mjs --plan` is read-only. Explicit `--run` on Windows requires exactly `Bostan-B###-qa` and a matching `Bostan-B###-temp` directory, real private Bostan repo identity, no inherited managed cloud settings, existing disk/memory gates, and **exact production SHA256 admission** on the already built `dist-runtime`.

Crucial database isolation: it **opens and retains a bound ephemeral TCP listener** on `127.0.0.1` that immediately destroys any connection; this listener's random port is passed as `DATABASE_URL`. Thus no real PostgreSQL server can bind that same port or receive SQL. The HTTP port is separately randomized. The child gets the existing credential-free synthetic private QA environment and owner marker; it does NOT inherit operator tokens or profiles. No data stored in a persistent customer DB.

Launches the exact preloaded/guarded packed application child with the local Node CPU profiler for a bounded 36 seconds or until it closes. Captures child output **only in memory**, prints **allowlisted constant stage names and aggregated CPU sample categories**, never raw stderr, profile URLs, environment keys, network URLs, stack traces or credentials. Stops **only** its own ChildProcess (bounded stop/close, bounded escalation), closes fake DB socket, deletes **only** the exact fresh owned temporary QA directory after verifying ownership and child closed; otherwise preserves it and fails. No external provider calls.

This run is deliberately **diagnostic**, never an HTTP, PostgreSQL, first-admin, UI, or release PASS.

## Actual native device execution

Authorized native Windows Node24 Windows 11, isolated D:\\Bostan-B135-qa; source HEAD `812c29eaf5304bdb0ffbeb53259e8c0fe8195d8b`:
- Syntax `node --check` **EXIT 0**, read-only `--plan` **EXIT 0**. Also ran syntax/read-only plan on real Mac Node26 **EXIT 0**, Mac execution refused by platform guard as intended.
- Preflight Windows **RAM 5.11GiB, D 9.35GiB**, no other owned Bostan build and no existing PostgreSQL process. Ran actual `node scripts/bostan-private-windows-packed-import-probe.mjs --run` with `TEMP=D:\\Bostan-B135-temp`: wrapper **EXIT 0**, wall runtime **37.71s**.
- Safe proof:
  - `BOSTAN_WIN_IMPORT_ONLY_OUTCOME=child_exited`
  - `BOSTAN_WIN_IMPORT_ONLY_FIRST_STAGE=static_import_start`
  - `BOSTAN_WIN_IMPORT_ONLY_LAST_STAGE=static_import_start`
  - `BOSTAN_WIN_IMPORT_ONLY_STAGE_COUNT=1`
  - `BOSTAN_WIN_IMPORT_ONLY_CHILD_CLOSED=true`
  - `BOSTAN_WIN_IMPORT_ONLY_FORCED=false`
  - `BOSTAN_WIN_IMPORT_ONLY_REAL_POSTGRES_USED=false`
  - `BOSTAN_WIN_IMPORT_ONLY_CPU_SAMPLES={"runtime":337,"thirdParty":1284,"nodeInternal":2893,"other":7926}`
  - `BOSTAN_WIN_IMPORT_ONLY_OWNED_FIXTURE_CLEANED=true`.
- Independent after-run process/resource receipt: `WIN_CPU_IMPORT_PROBE_EXIT=0`, **0 postgres.exe processes**, ~5.21 GiB RAM free, ~9.35GiB D free. No unrelated process kill or user file modification.

The CPU profile was **destroyed with its synthetic owned scratch directory** after summarization; sample category counts are informative, but do **not** identify a proven slow module or causal stack. The sole emitted pre-import stage implies the interval's 30s callback never executed before the child closed; this is consistent with long or blocking early module evaluation, but not proof of a specific library defect. The child exit itself may reflect the deliberately absent PostgreSQL, unlike the real full integration environment. It is **not** an authenticated server acceptance or successful compiled startup.

## Still RED — required next product gates

Full native Windows SHA-owned packed server + **real** PostgreSQL + 18-stage localhost Better Auth/first admin **#237** remains red, as does actual owned PG teardown and broad multi-suite orphan **#234**. Need further CPU callFrame analysis with safe path redaction to narrow the hot import function, then a verified source fix and a full real E2E re-run with disk/cleanup admission. Separate Mac B1-40 did pass **43 real packed runtime + PG/Better Auth requests**, and B1-41 real Mac Chromium Vite production first paint passed **zero JS errors/zero external requests**, but they do **not** constitute one combined browser-to-backend user journey. First genuine free local agent, installers, Linux/Windows browser qualification, security, privacy, full typecheck, license/NOTICE and release gates remain. **Release NO-GO**.
