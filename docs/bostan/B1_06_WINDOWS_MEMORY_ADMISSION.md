# B1-06 — Native Windows memory admission before real authenticated HTTP

Date: 2026-10-28. PRIVATE stacked Draft on B1-05 PR #257 (exact verified base head `7f90df79c2bf7d1a3264c5a7ad420e04f8d82171`). Do not merge, publish, deploy, enable GitHub Actions, use paid cloud/models, touch operator files or claim native qualification.

## Concrete gap and fix

The existing Windows native authenticated HTTP runner `scripts/bostan-private-windows-live-http.mjs` enforced B0-91 disk headroom before allocating a fixture, but had **no RAM admission** before launching a real embedded PostgreSQL 18 test cluster and TypeScript server. This could cause avoidable swapping or system pressure even when the disk gate passed. B1-06 adds `scripts/bostan-private-windows-memory-admission.mjs`:

- Windows only; read-only OS `os.freemem()` and `os.totalmem()`. Require **at least 6 GiB total physical RAM** and **at least 2 GiB currently free physical RAM**. These are conservative QA resource thresholds, **not** proof that the full Bostan app will fit in memory.
- Refuse non-Windows, unavailable probes, exceptions, invalid/negative/noninteger/unsafe values, zero total, and free greater than total. Do not echo raw exception messages, environment variables, filesystem paths or secrets.
- CLI defaults to inert `--plan`; explicit `--check` reads only. Unknown options exit 2; no installation, process termination or filesystem writes.
- The real native runner now checks memory **after the disk gate but before `mkdtempSync` or PostgreSQL startup**, and checks again **after real PostgreSQL migration but before spawning the TypeScript server**. The second check's failure throws into the existing owned DB/server teardown path, with safe reason-only diagnostics.
- Avoid running the PostgreSQL orphan PowerShell scanner when the embedded DB was never created (`if(db&&serverClosed&&dbCleaned)`), while retaining the B1-05 independent 16-stage process-tree gate when the DB did start.
- Repair misleading server elapsed diagnostics on pre-server failure: report `not_started` rather than seconds since the Unix epoch when the server was never spawned.
- `releaseQualified:false` and all B1-05 independent PG process-tree requirements remain unchanged.

## Verified tests and evidence

Isolated **Linux Node 22.16.0**, local test workspace only `/mnt/data/bostan-b106-isolated`. No user device or existing repository checkout was altered.

| Artifact | Exact GitHub blob | Actual validation |
|---|---|---|
| `scripts/bostan-private-windows-memory-admission.mjs` | `f86a287ebb7927b989715471631c9e179b00a5db` | **8/8 Node tests PASS**, 0 fail, 0 skipped, local test bytes matched GitHub blob |
| `scripts/bostan-private-windows-memory-admission.test.mjs` | `2a04f0cbe6b352228888856092f02ae3d0801288` | Same **8/8 PASS**, includes real Node subprocess for inert plan, rejected commands and non-Windows `--check` |
| `scripts/bostan-private-windows-live-http.mjs` | `e824cbe4cc408333a5960f7e92389e10ccaa8bb1` | Source syntax parsed and 11 source integration invariants checked, **native Windows run NOT executed** |
| `scripts/bostan-private-windows-live-http.test.mjs` | `acd75435b1c4614a9e0bce246ab986e5d336a948` | Source syntax parsed, source assertions added; **complete test suite NOT executed** |

Tests cover exact memory boundary, one byte below thresholds, malformed/inconsistent OS readings, non-Windows refusal without reading host counters, exceptions without secret leakage, frozen receipts, real Node CLI plan, unknown command rejection, and non-Windows `--check` exit 2.

The 11 checked integration invariants include: disk before RAM before fixture, second RAM gate after DB and before app spawn, cleanup on post-DB low memory, no orphan scan if DB was never created, no bogus elapsed time, source regression assertions and unconditional `releaseQualified:false`. These are **static source checks**, not evidence of native Windows or full app success.

## Remaining gates / NO-GO

- Actual native Windows machine was **not accessed**. Last observed Windows C: ~0.323 GiB free (below >=2 GiB disk gate); authorized desktop quota exhausted. No attempts to bypass quota, no cleaning of user files. Current native RAM has **not** been measured. Do not run real PG, Chromium or installers without both memory and disk admission and an owned QA checkout/TEMP.
- Open [#237](https://github.com/TheHalfMoon/Bostan/issues/237) native Windows full authenticated HTTP startup and [#234](https://github.com/TheHalfMoon/Bostan/issues/234) PostgreSQL orphan process proof. B1-05 requires 16 exact ordered native markers; B1-06 adds RAM admission but **does not satisfy any of those native markers**.
- Remaining independent gates: latest macOS native 16-stage HTTP/PG teardown, Windows/macOS Chromium Playwright E2E, real zero-cost agent workflow, reproducible compiled server build, cross-platform installers, security/licensing, recovery/backup and operational QA. Release stays **NO-GO**.

Bostan name retained. PRIVATE Draft only; no merge/release/publication.
