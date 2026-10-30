# B1-63 — Bounded private Windows packed ESM evaluation trace

Date: 2026-10-30. Strictly PRIVATE, ZERO COST, NONPUBLISHING. Exact stacked parent B1-62 Draft #316 head `f8d113096e6335d8072143db759788f2fc6bc8a1`.

## Motivation and scope

B1-60's native Windows combined Chromium/Better Auth/real PostgreSQL test was RED before HTTP readiness. B1-62's independent Worker emitted a 30-second heartbeat while the main-thread timer did not, with moderate aggregate process CPU activity. That observation does not identify the blocking source module or distinguish CPU work from synchronous I/O. Re-running the expensive 180-second PG/browser suite without a narrower diagnosis would waste constrained Windows resources.

This change adds a **separate opt-in** `--run-trace` to the existing 36-second, no-real-PostgreSQL packed import probe. The original `--run` mode, hard deadline, resource guard, SHA256 packed-runtime ownership admission, private synthetic fixture marker, lifecycle cleanup and strict CPU-profile EXIT-1 behavior are unchanged.

Only after the existing Windows private QA entry guard passes, a test-only Node 24+ synchronous ESM load hook instruments the **in-memory** source of admitted `server/dist-runtime/{index,server,chunk-*}.mjs` files. It does not rewrite any packed file or manifest. Every entered module writes `BOSTAN_WIN_CHUNK_EVAL=<12-hex>` directly to the inherited OS stderr descriptor. The identifier is a SHA256 prefix of the runtime-relative filename; neither the filename nor any absolute path, stack, secret, environment value or model data is printed. The parent emits only bounded count and last ID, plus `BOSTAN_WIN_IMPORT_ONLY_TRACE_QUALIFIED=false`. Unknown files and non-ESM modules are untouched; linked files escaping the admitted runtime fail closed.

**Important:** An evaluation marker identifies an entered module, not the exact offending statement. In-memory instrumentation changes the QA execution and is not equivalent to a pristine production-bundle pass. Missing markers, CPU profile unavailability, failed cleanup or timeout remain RED. This is diagnostic evidence only, not a server/PG/Chromium qualification.

## Executed evidence

- Isolated authorized Mac checkout cloned at exact B1-62 head. Native Node 26: **17 PASS, 0 FAIL, 1 SKIP** across new eval-trace tests and inherited startup/heartbeat tests; the skip is the explicitly Windows-only guarded-child test.
- Actual Node ESM hook smoke imported two synthetic packed modules and observed exactly two fixed digest-only markers while preserving the correct module value; no raw path in child stderr. A first run exposed a real `/tmp` vs `/private/tmp` canonical-alias mismatch (0 observed markers), repaired before the final GREEN test.
- Actual guard-denial child EXIT 2 before application entry; owned runtime symlink escape rejected; unknown module names excluded.
- `node --check` for new preloader/helper and modified probe PASS; original `--plan` remains inert, `run:false`, `realDatabase:false`, `deadlineSeconds:36`, `releaseQualified:false`.
- Mac temporary synthetic fixtures were removed by their own tests. Existing B135 checkout, user files and unrelated PostgreSQL processes were not touched.
- Windows authorized device was online, native Node v24.19.0, RAM ~5.05 GiB, C ~3.58 GiB and D ~7.46 GiB at final preflight. **No actual Windows trace run or real PG/browser E2E was executed in this change.** The 36-second trace must still be proven on Windows with resource and ownership checks.

## Next qualification

Run only the opt-in 36-second no-PostgreSQL trace from a separately owned exact-SHA Windows QA checkout when free RAM/disk meet the unchanged admission limits and no concurrent work conflicts. Correlate the last digest with the SHA-admitted local chunk list **without exporting raw filenames or stack data**. Fix the actual Windows source/import bottleneck only after positive evidence. Then rerun HTTP health, 18-stage Better Auth/Chromium and 12 same-PostgreSQL writes with independent no-orphan cleanup.

**Release NO-GO.** Native Linux app, installers, sustained load, untrusted-agent effects sandbox and independent privacy/security/license/NOTICE/provenance reviews remain gates. No main merge, Actions, deployment, publish/release, npm pack, paid models/cloud or customer data.
