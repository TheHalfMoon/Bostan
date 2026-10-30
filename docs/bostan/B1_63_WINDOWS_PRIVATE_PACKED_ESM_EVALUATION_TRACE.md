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
- Windows authorized device was online, native Node v24.19.0, RAM ~5.05 GiB, C ~3.58 GiB and D ~7.46 GiB at initial preflight. The later native Windows bounded trace and its exact limitations are recorded below; **no real PG/browser E2E was executed in this change**.

## Next qualification

Run only the opt-in 36-second no-PostgreSQL trace from a separately owned exact-SHA Windows QA checkout when free RAM/disk meet the unchanged admission limits and no concurrent work conflicts. Correlate the last digest with the SHA-admitted local chunk list **without exporting raw filenames or stack data**. Fix the actual Windows source/import bottleneck only after positive evidence. Then rerun HTTP health, 18-stage Better Auth/Chromium and 12 same-PostgreSQL writes with independent no-orphan cleanup.

**Release NO-GO.** Native Linux app, installers, sustained load, untrusted-agent effects sandbox and independent privacy/security/license/NOTICE/provenance reviews remain gates. No main merge, Actions, deployment, publish/release, npm pack, paid models/cloud or customer data.

## Native Windows follow-up: real probe RED exposed a false-GREEN diagnostic

An isolated B163 QA checkout at exact PR source was cloned on authorized native Windows Node v24.19.0. A previously SHA256-admitted **238-generated-file packed runtime** and the exact compiled source entry were copied read-only from the earlier B144 owned QA build, then re-admitted with a new **B163-local owner manifest**; the GitHub comparison from the B144 build source to B163 showed **only diagnostic scripts/docs changed**, not server/package source. The B144 checkout was not edited. This avoided a memory-heavy rebuild. No dependencies were installed in the new minimal clone.

**First real native Windows 36s no-PG trace:** preflight 5.06 GiB free RAM, 7.15 GiB free D; actual child **exited with code 1** due `ERR_MODULE_NOT_FOUND`, allowlisted package `smol-toml` absent from the isolated minimal clone. Only the packed entry module was observed (`CHUNK_EVAL_COUNT=1`, digest `d6299b5bb2af`); this is a **QA fixture dependency gap**, not evidence of the original Windows import hang or a Bostan production dependency defect. A valid owned V8 CPU profile existed (227 samples), child closed without force, no genuine PostgreSQL, owned temporary fixture cleaned.

**Actual defect discovered:** the original diagnostic wrapper nevertheless returned **EXIT 0** because it checked profile/cleanup but did **not** fail when its child exited nonzero. That is a real false-GREEN in the diagnostic, not a product E2E pass. Added `admitPrivateWindowsProbeChildExit()`: a child exiting nonzero/null now fails closed; a bounded 36s observation remains a diagnostic only. New regression cases include exit 1, exit 2, null, 0, timeout and invalid outcome.

**After repair at exact source `a065e24a1b81d4f78ee42e95c5a8511a510c389c`:**
- Native Windows Node v24.19.0 focused suites **19 PASS, 0 FAIL, 1 SKIP** (Windows symlink privilege); Mac Node 26 **19 PASS, 0 FAIL, 1 SKIP** (Windows-only guarded-child case).
- Actual Windows owned 36s no-PG trace repeated at 5.08 GiB RAM / 7.15 GiB D: `OUTCOME=child_exited`, `CHILD_EXIT_ADMITTED=false`, `CHILD_CLOSED=true`, `FORCED=false`, `REAL_POSTGRES_USED=false`, `OWNED_FIXTURE_CLEANED=true`, same allowlisted missing-package classification, and **TRACE_PROCESS_EXIT=1**. This proves the wrapper now fails closed under the actual observed error.
- Independent postrun native Windows read-only scan: **0 owned B163 Node processes, 0 PostgreSQL processes, 0 owned import fixture directories, 0 tracked B163 source edits**. B144 remained at its original SHA. Windows D ~7.15 GiB and free RAM ~5.11 GiB.
- The B163 QA checkout and its matching empty owned TEMP root were retained; no unrelated files/processes were removed or terminated.

**Still RED:** this did not reproduce the original B144 import stall with full dependencies, identify a hot chunk, or qualify Windows HTTP/Better Auth/Chromium/shared-PostgreSQL concurrency. A future exact-head trace needs a dependency-complete isolated Windows QA checkout and the same resource/ownership gates. No claim of product startup success.
