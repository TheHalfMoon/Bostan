# B1-83 — Windows postmaster.pid high-bit byte validation

**Strictly private / zero-cost / nonpublishing / stacked Draft only.**

## Reproduction on exact B1-82 parent

The native Windows synthetic QA teardown reads the first line of `postmaster.pid` and checks for a decimal PID before invoking `pg_ctl stop`. Node.js `Buffer.toString("ascii")` **masks the high bit** of each byte, so a marker containing bytes `B1 32 33 0A` is interpreted as `123\n`. On the exact parent commit `4266680438cd16de8e4d1de812413cd6d9eb82e9`, an isolated Mac Node 26 source execution with this malformed marker **returned `stopped`**, invoked the synthetic shutdown runner once, and made two synthetic process inspections. No real PostgreSQL process was contacted.

## Narrow mitigation

Use `latin1` for bounded PID-line decoding so all original 8-bit values survive until the existing `^[1-9]\d{0,9}$` validation. Add three high-bit synthetic regression cases requiring zero shutdown invocations and zero process inspections. This changes only the **test-only** PostgreSQL stop helper; no production app startup, migration, or process kill logic is changed.

## Qualification limits

A synthetic Mac reproduction is **not** native Windows multi-suite PostgreSQL process ownership/quiescence proof (issue #234), nor Windows packed server/Better Auth/HTTP qualification (issue #237). Do not use this test to justify fixture deletion or release. Windows device identity differs from the previously authorized device, so do not execute there. Preserve retained QA fixtures and unrelated processes. No merge to main, GitHub Actions enablement, publication, deployment, release, npm pack, paid services, or user data.

## Objective verification — 2026-10-31

- Mac Node.js v26.0.0, Vitest v5.0.3, one worker, 1024 MiB heap.
- RED: with the new regression on the exact B1-82 source, **41 PASS / 1 FAIL / 1 SKIP**. The failure recorded a synthetic shutdown invocation despite malformed high-bit PID bytes.
- GREEN: with the narrow `latin1` decoding change, **42 PASS / 0 FAIL / 1 SKIP**. All three high-bit cases reject before the synthetic shutdown runner and process inspector.
- Targeted TypeScript 7 `tsc --noEmit -p packages/db/tsconfig.json`: EXIT 0.
- `git diff --check`: EXIT 0.
- Original B1-82 parent SHA: `4266680438cd16de8e4d1de812413cd6d9eb82e9`.
- Native Windows execution: **not performed** (connected device ID not previously authorized).
- All regression fixtures are synthetic and were removed by the owned test harness. No real database, Chromium, cloud, external models, or production data used.
