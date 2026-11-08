# B1-76 — Fail closed on Windows PostgreSQL PG_VERSION marker identity

**Scope:** Private, zero-cost, nonpublishing test-only teardown. **Release:** NO-GO.

**Exact parent:** B1-75 Draft PR #330 head `071e69fbd888cebd99960ca2f4a007e87b11ac6e`. This change is stacked directly above that head. No main merge or release.

## Source-level defect and RED receipt

B1-75 preserves the scratch *directory* identity across the two pinned-binary process snapshots, but checks `PG_VERSION` with `existsSync`. That accepts a directory in place of the version marker, and accepts a different regular file or a symlink swapped into the same path during the worker verification window.

On an isolated authorized Mac sparse checkout at the exact B1-75 parent, four additional synthetic regression tests produced **24 PASS / 3 FAIL**: a `PG_VERSION` directory, a replacement regular file, and a newly introduced symlink were incorrectly accepted with `already-stopped`. The fourth test, an initially dangling symlink, was already rejected due to the existing existence check. These are source-level synthetic defects, **not** evidence of a real PostgreSQL orphan or compromise.

## Narrow mitigation

Use `lstatSync` to require a regular non-symlink `PG_VERSION` at entry. Capture its device/inode/birthtime identity. Before either successful shutdown receipt, require the same regular non-symlink file identity alongside the existing scratch-directory and `postmaster.pid` checks. Any missing, ambiguous, replaced or inaccessible marker fails closed with constant privacy-safe messages. No process is terminated, no retained fixture is deleted, and no production application behavior changes.

## Objective tests and limitations

- Mac Node 26, Vitest 5, one worker, 1024 MiB heap: **27 PASS / 0 FAIL** (all 4 new cases included).
- Native Windows 11 on authorized Abdulaziz device, Node 24.19.0 / Vitest 5, 768 MiB heap, one worker: **22 PASS / 0 FAIL / 5 SKIP** (Windows symlink privilege cases intentionally skipped). The ordinary-file replacement and directory-marker regressions passed on NTFS. This is a real Windows *synthetic test* execution, not a real PostgreSQL teardown.
- Targeted TypeScript 7 `--strict --noEmit`, 768 MiB heap: **EXIT 0**.
- `git diff --check`: **EXIT 0**.
- Windows admission before the lightweight run: C **9.74 GiB**, D **12.19 GiB**, free RAM **4.03 GiB**, 0 postgres.exe, 22 node.exe. No heavy build or 180-second E2E was attempted.
- Native Windows full PostgreSQL/Better Auth/Chromium tests remain unqualified; synthetic Windows tests establish only the guarded helper behavior, not real PostgreSQL worker ownership or multi-suite cleanup. Exact PID/parent/creation-time ownership, #234 multiple-suite no-orphan, #237 packed server startup, HTTP and Better Auth remain gates.

**Privacy/safety:** No Actions enablement, npm pack, publication, merge, deployment, paid models/cloud, customer data, foreign-process termination, or old-fixture deletion. Keep all PRs Draft.
