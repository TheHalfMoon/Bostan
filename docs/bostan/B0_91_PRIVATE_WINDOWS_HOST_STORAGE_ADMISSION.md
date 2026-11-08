# B0-91 — Native Windows host storage admission for private Bostan QA

2026-10-28. Private stacked work after B0-90 PR #241. Bostan remains PRIVATE; no merge, release, provider calls, user-data mutation or GitHub Actions.

## Actual blocker

Before B0-91, native Windows 11 host inspection recorded **C: 0.097 GiB free** and **D: 10.62 GiB free**. The older private HTTP/PostgreSQL QA wrapper checked only the checkout volume (historically 1 GiB); the live server wrapper did not check system-volume free space before creating a synthetic test home and PostgreSQL. B0-87's cold import/build attempts had previously consumed substantial disk and stalled under pressure. A fresh heavy native Windows fixture would risk harming the operating system while C: is almost full.

## Implementation

- New dependency-free `scripts/bostan-private-windows-disk-admission.mjs` checks the actual Windows system, checkout and TEMP volume space with Node `statfsSync(..., {bigint:true})` and refuses uninspectable/invalid volumes.
- Minimum free space, by distinct volume: **2 GiB system**, **6 GiB checkout**, **6 GiB TEMP**. A shared volume must satisfy the *maximum* of its applicable minimums, never the minimum; results have no private paths. Fractional GiB are preserved to 0.01 via BigInt arithmetic.
- Integrates fail-closed admission into `bostan-private-windows-auth-db.mjs --run` before build/test/DB steps, and `bostan-private-windows-live-http.mjs --run` before creation of an owned temporary home and PostgreSQL startup.
- Default invocation remains an inert read-only plan. `--check` is a read-only host admission receipt with nonzero exit code when storage is insufficient. No disk cleaning, moving user files, installations, npm downloads, or remote network activity.

## Verified tests and real host behavior

Mac Node 26: **23/23 focused tests PASS, 0 fail** (resource pure-function cases plus prior native auth/diagnostic tests). The new tests cover low system space, separate TEMP volume, single-volume max threshold, inaccessible volume fail-closed, malformed volume, non-Windows refusal, no private paths in output, fractional free capacity and both heavy wrappers using admission before side effects.

On real Windows 11 Node 24.19, isolated B0-91 QA checkout, the initial candidate achieved **22/22 PASS**. The final exact-head retake at commit `dc5ec0f` achieved **23/23 focused tests PASS, 0 fail, 0 skipped**, including the new fractional-space reporting test. With an owned D: TEMP and real C: at **0.14 GiB** on final retake, read-only `--check`, authenticated route/real PG wrapper `--run`, and live localhost HTTP wrapper `--run` all **refused with code 2** and `reason=low_disk`; D: reported **10.37 GiB** free. Test-owned PostgreSQL process count **0**; no database or server was started. These are fail-closed safety tests, not proof of live server readiness.

## Remaining Bostan release blockers

This qualifies a **safety admission mechanism**, not an authenticated Windows production server. Real live Bostan startup with the B0-90 module-load profiler, Better Auth session and first-admin claim, Playwright Chromium browser, a complete reproducible compiled build, native installers, real no-cost agent work and independent security/licensing remain OPEN. No heavy Windows acceptance run should start unless system drive and test-owned volumes pass read-only admission. Avoid cleaning any non-test user files without explicit task scope.

**Bostan release NO-GO**.
