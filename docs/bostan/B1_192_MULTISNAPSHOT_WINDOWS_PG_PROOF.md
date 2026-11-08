# B1-192 — Require repeated independent Windows PostgreSQL no-orphan observations

Date: 2026-11-02 Asia/Riyadh. **PRIVATE / DRAFT / UNMERGED / NO-GO**.

## Release risk and specific repair

Open #234 documents **six real Windows `postgres.exe --forkchild=io_worker` orphans** from earlier native embedded-PostgreSQL test teardown. The existing Bostan PowerShell process scanner was read-only and conservative about foreign processes, but it made only **one** `Get-CimInstance Win32_Process` observation before printing a `BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS` receipt. One clean sample cannot detect late workers that appear just after that observation.

The scanner now performs **three separate CIM observations**, spaced by **250 ms**. It **aggregates any owned worker or uninspectable/foreign PostgreSQL process observed in *any* sample** and exits nonzero if one was seen, even if later scans are clean. It does not terminate/clean any process or file. Unexpected CIM errors fail closed. The existing check for an owned *private Bostan* manifest is preserved. Successful receipts now contain **four exact records**: the required `BOSTAN_WINDOWS_PG_SNAPSHOTS=3` followed by existing zero-owned, zero-uninspectable and success records. This strengthens the semantics of the no-orphan claim without changing its public result-schema key.

The consumer `scripts/bostan-private-windows-pg-orphan-proof.mjs` accepts **only** exactly that four-line receipt with clean exit and empty stderr; the legacy three-line single-snapshot success now fails closed. The pre-existing strict verifier regression suite is updated from expected 3 records to 4, not deleted. A new 8-case suite verifies correct receipt; rejection of old receipt and wrong/ambiguous count; nonzero/foreign process; duplicate, reordered, appended or whitespace-forged records; timeouts and nonclean exits; redaction; and scanner source's independent sampling/read-only contract.

## Verified evidence and limits

Exact GitHub blobs:

- `scripts/bostan-native-windows-postgres-no-orphans.ps1` `07c4354183e8c52ba84e001c28601e52b3d15eac`.
- `scripts/bostan-private-windows-pg-orphan-proof.mjs` `50ae9362fb976fd01ffb60b3f011233133eca9de`.
- `scripts/bostan-private-windows-pg-multisnapshot.test.mjs` `abd995d7871bf3b792b28df29da852dd05c8bb03`.
- `scripts/bostan-private-windows-pg-orphan-proof.test.mjs` `9a56321400219101e59098152cade9bdcabdf669`.

An **isolated Linux Node22 actual native** execution of the exact new helper, scanner source and 8-case test file (independent git blob hashes matching above) passed **8/8, 0 skipped, exit0**. An old three-record proof module on the same tests failed as expected (module did not export the required sample-count constant). Source tests enforce the PowerShell scanner's multi-sample loop placement, but this is **NOT a native PowerShell execution** or real PostgreSQL force-crash test. The prior verifier's single length assertion was updated; no full root TypeScript7/Vitest or Windows end-to-end integration claim is made.

## Device access and safety disposition

Prior to scanner work, Windows RAM fluctuated across physical checks, and a copied pinned PostgreSQL 18.1 native bundle of around **104 MB** was staged into a new **exclusive** `D:\Bostan-B212-qa\native` directory after an admission check. No `postgres.exe` server start, initdb, forced crash, process stop or database mutation was requested. Immediately afterward the connected Desktop Commander reported its **monthly usage limit** and further device calls were paused. Thus the current B212 directory content and any copy completion receipt **could not be independently reverified**. It **must be retained for later safe inventory/hash/ownership inspection**; do not silently delete or claim it was cleaned, and do not bypass the device's quota. Retained B135, B177 and other QA directories were never altered by this change.

## Exact limits / no-go gates

Three samples over approximately 500 ms provide bounded temporal evidence, not an atomic process snapshot nor proof that no process can start later. **Issue #234 remains OPEN** until a resource-gated native Windows real forced-crash PostgreSQL run proves zero orphan `io_worker` descendants over repeated owned suites without touching foreign processes. **Issue #237 remains OPEN** until a fresh exact-SHA-owned fully installed Windows compiled authenticated HTTP/Better Auth first-admin, sessions, tenant authorization, and Chromium journey succeeds with reliable teardown. Other gates: native Mac/Linux real cache performance, full root TypeScript7/Vitest, Linux sandbox bwrap, Windows/macOS/Linux installed app, privacy, consent, security and donor LICENSE/NOTICE. Release stays **NO-GO**, no main merge, Actions, deployment or publishing.
