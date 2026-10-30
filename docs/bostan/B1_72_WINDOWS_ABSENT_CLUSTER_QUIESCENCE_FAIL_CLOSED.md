# B1-72 — Fail closed on a missing Windows PostgreSQL scratch directory

Date: 2026-10-30. Exact stacked parent: PRIVATE Draft PR #325, head `d79aeb80187db6b2bb7002bc2030ac0739f2e49f`.

## Verified test-only defect

The B1-71 Windows teardown helper returned `already-stopped` immediately if the scratch data directory was missing. That shortcut bypassed the independent pinned-binary process proof introduced in B1-70. If a failed initdb or earlier cleanup had removed the directory while a pinned PostgreSQL `io_worker` remained alive, the caller could report successful cleanup without inspecting any worker.

Three controlled regression tests on the exact B1-71 parent were **RED**: a missing directory with a pinned worker incorrectly returned success; a missing directory with a clean inspector skipped both required snapshots; and a missing directory recreated during inspection was incorrectly accepted. Baseline: **11 PASS / 3 FAIL** in the focused Windows-stop test file. These are injected synthetic process snapshots, not a claim that this state occurred on a live Windows database.

## Narrow mitigation

- Validate the absolute `pg_ctl.exe` identity before handling a missing directory.
- Inspect directory existence with `lstat`, distinguishing `ENOENT` from inaccessible paths and dangling symlinks.
- Even when the directory is absent, require the existing bounded two-clean-snapshot proof that no pinned PostgreSQL executable process remains. Fail closed on live workers, unknown identity or inspection failure.
- Recheck that the directory has not appeared during inspection before returning success. Retain any reappeared fixture through the caller's existing failure path.
- No process termination, fixture deletion, production-server change, Windows template-cache reenablement or foreign-process action.

## Objective qualification

- Mac Node 26 / Vitest 5, single worker, capped 1024 MiB: **18 PASS / 0 FAIL** across 16 Windows teardown policy cases and 2 template policy cases. The three original failing regressions are green; two additional tests cover invalid shutdown binary and dangling symlink.
- TypeScript 7.0.2 targeted strict `--ignoreConfig --strict --noEmit --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext --types node --typeRoots packages/db/node_modules/@types` on the exact helper: **EXIT 0** with a 768 MiB Node heap cap. `git diff --check`: **EXIT 0**.
- Real native Windows PostgreSQL teardown, packed runtime, 18-stage Better Auth/HTTP, Chromium and multi-suite no-orphan qualification **NOT RUN**. Windows C/D remain below 6 GiB admission threshold; no heavy workload is authorized.

## Remaining safety limitations

The process proof remains **executable-wide**, not an exact owned PID/parent/creation-time graph. A concurrent suite using the same pinned binary can conservatively block cleanup. A directory can still be created after the final check. The fix does not prevent worker creation or prove zero orphans. Issue #234 and #237 remain open; release **NO-GO**.

STRICTLY PRIVATE / ZERO-COST / DRAFT / NONPUBLISHING. Do not merge main, enable Actions, deploy, release, npm pack, use paid models/compute/cloud, process customer data, kill unowned processes, or clean up retained fixtures.
