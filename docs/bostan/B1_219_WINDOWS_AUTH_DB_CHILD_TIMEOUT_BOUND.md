# B1-219 — Bound private Windows auth/DB child execution timeouts

**PRIVATE OPEN DRAFT ONLY. RELEASE NO-GO.** Direct parent #475 exact HEAD `f835248788d3549afcc81ab754658f1b4b5b39c5`.

## Source-backed gap

The B1-218 captured-child helper required a positive safe-integer timeout but had no upper bound. A future direct helper caller could pass 2,147,483,647 ms (~24.8 days) to `spawnSync`, preventing the synchronous runner from reaching its final read-only PostgreSQL orphan scan for an excessive period. The existing B1-209 execution planner already uses at most 240,000 ms per workload and 20,000 ms per orphan gate; this is a defense-in-depth guard against future callers, **not** evidence that the existing runner used such a timeout.

## Repair and verification

Export `PRIVATE_WINDOWS_AUTH_DB_CHILD_MAX_TIMEOUT_MS=240000` and reject larger timeouts **before spawn**. Preserve all existing command path, environment, offline, output-buffer, shell, and orphan-scan behavior. The limit is not a wall-clock or descendant-process attestation; `spawnSync` timeout cannot prove that grandchildren have exited.

Actual isolated Linux Node 22.16.0 test-first against original exact Git blob `75d47346d46b6e3d3dd20147a92f75fde2ff9d8c`: **4 PASS / 3 expected RED** in seven tests. Repaired seven tests **7/7 PASS**, zero skipped, exit 0; `node --check` helper and test PASS. Includes real synthetic local Node success and timeout with suppressed secret diagnostic. No native Windows/PG/Chromium, full TS7/Vitest, or installed E2E.

Locally tested expected Git blobs:
- Helper: `b86c17b29380758ca2b4dd15eae5a332f642173c`
- New tests: `c5f8084895ee2382480888c060d2bf2d107d801c`

## Remaining release blockers

#234 repeated genuine native Windows PostgreSQL18.1 forced-crash io_worker zero-orphan and safe owned teardown without foreign kills; #237 installed compiled authenticated localhost Better Auth/roles/tenant with real Chromium; full TS7/Vitest, real Linux bwrap, macOS/Linux PG cache, installed three-OS E2E, privacy/consent/security/donor provenance. Remote Desktop Commander monthly quota not retried or bypassed; retained `D:/Bostan-B212-qa` untouched. No main merge, Actions, public release, cloud/paid providers, customer data, foreign-process termination, or donor LICENSE/NOTICE changes. **RELEASE NO-GO.**
