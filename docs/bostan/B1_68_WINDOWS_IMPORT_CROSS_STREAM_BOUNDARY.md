# B1-68 — Private Windows ESM trace cross-stream boundary integrity

Date: 2026-10-30. Repository: `TheHalfMoon/Bostan` (PRIVATE). Exact parent: B1-67 Draft PR #321, `3070a143348c50f555dcfafda47ef594547a4ebc`.

## Finding (diagnostic harness, not a proven product defect)

The previous packed-import probe appended chunks from **stdout and stderr** to the same string with no source boundary. A stdout chunk ending in `BOSTAN_WIN_CHUNK_EVAL=` and an unrelated stderr chunk beginning `123456789abc\n` were combined into a syntactically valid ESM evaluation marker. This was reproduced in a native Windows regression test against the unchanged B1-67 helper. The resulting digest/count could falsely appear to be emitted by the application; it is not evidence of a real production event or actual data exposure.

## Narrow fail-closed fix

- Preserve normal same-stream chunk reconstruction.
- Track an allowlisted `stdout` or `stderr` source for each child chunk. On a source switch after a partial line, insert a delimiter so cross-stream fragments cannot synthesize a valid marker.
- Set a sticky `interleaved` flag and emit only `BOSTAN_WIN_IMPORT_ONLY_TRACE_INTERLEAVED=true/false`. `COUNTS_COMPLETE` becomes false and the diagnostic exits nonzero on interleaving or truncation.
- Keep capture in memory. Do not print raw child output, source paths, secrets, DSNs, credentials or profiles.
- Do not modify production server, package dependencies, the SHA256 packed-runtime gate, private synthetic QA guard, rejecting loopback PostgreSQL stub, 36-second deadline, child ownership, or fixture-cleanup policy.

## Executed proof

Authorized native Windows `Abdulaziz` (`6641fb27-1a94-40b7-a76d-06e5e61a49af`), Node `v24.19.0`. Read-only original B1-67 checkout at `D:\Bostan-B167-qa` stayed clean. A new, minimal owned `D:\Bostan-B168-qa` scratch contained only fetched source and tests, not a production bundle.

- **Baseline RED:** same seven tests against B1-67 helper: **4 PASS / 3 FAIL**; the cross-stream test explicitly reproduced a forged `BOSTAN_WIN_CHUNK_EVAL=123456789abc` marker.
- **Fixed GREEN:** exact GitHub B1-68 helper and tests: **7 PASS / 0 FAIL**.
- `node --check` for the new helper and packed probe: **PASS**.
- Separate local Linux Node 22 smoke suite: **7 PASS / 0 FAIL**.
- No heavy build, real PostgreSQL, Chromium, Better Auth, full semantic TypeScript check, 36-second packed probe, or multi-suite no-orphans qualification performed. These gates remain RED/UNKNOWN.
- Windows resource admission remains insufficient for heavy E2E: C and D each below 6 GiB free; do not bypass.

## Limitations and next

This is a **diagnostic evidence-integrity** fix only. `COUNTS_COMPLETE=true` still means merely that the bounded capture had no detected truncation or partial cross-stream switch; it does not prove a full event stream, HTTP readiness, application success or release qualification. The intermittent native Windows packed ESM startup remains unresolved. Next, with safe resources and owned cleanup proven, run the bounded packed probe and then real PostgreSQL/Better Auth/Chromium, 12 concurrent writes, #234/#237 orphan-process proof, Linux/installers, offline-agent security/privacy and licenses/NOTICE.

**Release: NO-GO.** No main merge, Actions enablement, deployment, release, npm pack, paid services, cloud models, customer data, unowned process termination, or disk cleanup.
