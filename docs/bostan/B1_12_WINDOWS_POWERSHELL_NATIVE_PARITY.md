# B1-12 — Native Windows PowerShell resolver and regression-test parity

Date: 2026-10-29. Bostan PRIVATE. Stacked on B1-11 Draft PR #263 at exact starting commit `b1f1215cade04abb750f6f3520683c7cf1c6a368`.

## Genuine native Windows reproduction

In an isolated, fresh `D:\Bostan-B111-qa` GitHub checkout with Node.js 24.19.0, the **original** selected seven node:test files executed on Windows (68 tests: **66 pass, 2 fail**). Both failures were in `bostan-private-windows-powershell-binary.test.mjs`: (a) an explicitly supplied `systemRoot: undefined` silently fell back to the host's actual SystemRoot before the spy was called, violating the intended reject-before-filesystem assertion; (b) a test assumed `C:\Windows` did not exist, which is untrue on actual Windows. The original full suite of 13 files showed 102 total: 98 pass, 3 fail, 1 skip, exposing three additional stale source-test assertions in the auth/DB harness.

## Focused repairs

1. `resolvePrivateWindowsPowerShellBinary` now distinguishes an explicitly present `systemRoot` key (even when undefined) from an omitted key. An explicitly undefined value fails closed without touching the file system; an omitted key retains its supported ambient SystemRoot behavior. No PATH search, subprocess or PID modification is introduced.
2. The real zero-exit subprocess test now injects a deterministic unavailable native filesystem rather than assuming `C:\Windows` does not exist; it verifies the same refusal on Windows, Linux and macOS.
3. The auth/DB source tests no longer hardcode the old B0 checkout name or search for environment sentinel constants in the parent HTTP runner. They assert the current three-digit QA wave parser and the actual child environment builder, and confirm the staged server entry uses the same sentinel. Production server and authorization code are unchanged.

## Executed exact-head checks

- Windows Node.js **24.19.0**, 13 `scripts/bostan-private-windows-*.test.mjs` files with `node --test --test-concurrency=1`: **102 total; 101 passed; 0 failed; 1 skipped** (5.803s). No DB or HTTP server was started by these source/regression tests.
- `node --check` passed for the modified resolver and auth/DB test.
- A native read-only `lstatSync` resolution of the current Windows SystemRoot to the system `System32\WindowsPowerShell\v1.0\powershell.exe` **passed**. The resolution did not launch PowerShell or terminate any process.
- Independent macOS arm64 test on the same exact commit `646dba84cb76d265b13c49e9c5cb620f1f6e7345` (Node.js 26.0.0): the two directly changed `bostan-private-windows-auth-db.test.mjs` and `bostan-private-windows-powershell-binary.test.mjs` suites **16/16 passed**, 0 failed/skipped, in an isolated private checkout. No full macOS product runtime was started.
- The fresh clone's initial commit matched GitHub `b1f1215cade04abb750f6f3520683c7cf1c6a368`. Modified files are limited to the resolver and two source/regression suites.

## Limitations and release gates

Native Windows available RAM was approximately **2.098 GiB** (just above the >=2 GiB minimum), C: free **3.134 GiB**, D: free **22.711 GiB**. The isolated repository had **no `node_modules`**, and no full native embedded PostgreSQL, compiled server, HTTP 18-stage, Chromium or packaging test was attempted. This result does **not** close issues #234 (PostgreSQL orphan workers) or #237 (real authenticated Windows HTTP/Chromium). The complete macOS 13-file Windows-harness suite and Linux replay of this patch are still pending; the focused macOS 16/16 replay is complete. Do not lower any resource admission threshold, use persistent databases, kill unrelated processes, or claim release qualification.

Bostan remains **PRIVATE**, GitHub Actions OFF, Draft stacked PR only; no merge to protected main, deploy, publish, release, paid inference or customer data. Full product release remains **NO-GO**.
