# B1-191 — Recheck native Windows HTTP/Chromium RAM before resource-heavy startup

Date: 2026-11-02 Asia/Riyadh. **PRIVATE / DRAFT / unmerged / release NO-GO.**

## Actual bug and resource evidence

The existing `scripts/bostan-private-windows-live-http.mjs` has a safe initial Windows RAM gate. Native Chromium mode requires **at least 4 GiB free** at admission, but its post-PostgreSQL-migration gate used **3 GiB**, allowing a browser/server startup to proceed when RAM had already fallen below the 4 GiB budget. Moreover, the initial check happened before resolving a compiled runtime and launching a temporary Chromium asset preflight. On the developer's Windows host, free RAM independently changed from approximately 5.05 GiB to 2.13 GiB and back above 4 GiB within short checks, making a stale admission plausible.

A resource-gated, bounded proposal to copy the pinned 104 MB PostgreSQL native bundle into a new owned B210 QA scratch directory was **correctly refused by the live Windows host check** because free RAM had fallen below 4 GiB immediately before the copy. No B210 QA directory, database or PostgreSQL process was created; no host safety guard was bypassed.

## Change

- New pure `scripts/bostan-private-windows-live-memory-policy.mjs` enforces the same **4 GiB free Chromium** criterion for every stage. The existing Windows memory checker still enforces its own minimum OS resources (6 GiB total, 2 GiB free); this change does not invent backend RAM requirements. Invalid/missing readings, nonboolean mode and explicit OS admission refusal fail closed; the policy yields immutable bounded reason codes, never source paths or secrets.
- Initial Chromium admission calls the shared policy rather than maintaining a second independent threshold.
- **Fresh pre-database check** executes *after* runtime/asset preflight and *before* the owned scratch directory and PostgreSQL cluster are created. Failure exits 2 with no PostgreSQL startup.
- **Post-migration check** uses the same 4 GiB browser threshold, replacing the weaker 3 GiB exception. Failure enters the existing bounded owned PostgreSQL teardown path.
- **Pre-server-spawn check** executes after preparing the synthetic HTTP environment and immediately before spawning the Node child, so a late memory drop fails into controlled owned cleanup. This does not guarantee RAM stays sufficient after spawn; no claim of an atomic memory reservation.

The legacy prohibition on non-Windows mode, managed cloud env, foreign paths and missing compiled assets stays unchanged. This is test-only qualification code, not production user session logic.

## Test-first proof and exact candidate

Isolated local Linux Node v22 pure policy regression first ran with a minimal replica of the original weaker post-migration threshold: **4 RED, 3 PASS, exit 1** (3.99 GiB and 3.5 GiB wrongly accepted; missing receipt fields and invalid mode acceptance). After repair **7/7 PASS, 0 skip, exit0**. The negative baseline is a faithful **policy replica**, not an execution of the whole source HTTP runner.

Then independently on **native Windows 11, Node v24.19.0** in a newly owned tiny `D:\Bostan-B211-qa` fixture, directly using exact private GitHub source blobs:

- Shared helper `scripts/bostan-private-windows-live-memory-policy.mjs`, blob `ea335a6edbb92323787b7a66dfdab75df8edafa5`.
- Pure regression tests `scripts/bostan-private-windows-live-memory-policy.test.mjs`, blob `516389f46704eaa184d10e704439857cc3db581e`.
- Structural source integration tests `scripts/bostan-private-windows-live-memory-integration.test.mjs`, blob `397ece61eca52ba0e02c44f204d0e487f5a857db`.
- Real HTTP QA source `scripts/bostan-private-windows-live-http.mjs`, blob `5af85fb754aa70228bd0c51eb7a2799ac99e924d`.

All four blobs independently matched native `git hash-object`. `node --check bostan-private-windows-live-http.mjs`: **exit 0**. Native Windows `node --test --test-reporter=spec` on two focused tests: **13 PASS, 0 SKIP, 0 FAIL, exit 0**; 7 behavior tests + 6 source-order/placement contract tests. PostgreSQL process count was **0** after run. These synthetic-only tests do **not** qualify a real PostgreSQL migration, compiled HTTP, Better Auth, Chromium or full source TS7.

## Limitations and next gates

This prevents an unsafe RAM cliff from starting new heavy work; it is NOT a native forced-crash or authenticated HTTP/Chromium success. Resource pressure can still change after a check. The app's entire installed cross-OS workflow remains unqualified. Do not claim Bostan release readiness from this.

Remaining release blockers include issue #234 repeated native Windows deliberate forced-crash PostgreSQL `io_worker` zero-orphan proof with owned process identities and noninterference, issue #237 fresh exact-source SHA-owned fully installed Windows compiled HTTP/Better Auth signup-cookie/first-admin/tenant/roles and real Chromium, native Mac/Linux template PG cache compatibility, full root TypeScript7, Linux bwrap, installed cross-OS, privacy/consent/security/tenant tests and donor LICENSE/NOTICE. **NO MERGE / NO ACTIONS / NO PUBLISH / NO DEPLOY / ZERO COST.**
