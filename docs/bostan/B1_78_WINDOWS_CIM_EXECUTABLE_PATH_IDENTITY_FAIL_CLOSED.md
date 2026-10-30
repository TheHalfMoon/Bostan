# B1-78 — Fail closed on ambiguous Windows CIM PostgreSQL executable paths

**Scope:** STRICTLY PRIVATE / ZERO COST / NONPUBLISHING / TEST-ONLY. **Release:** NO-GO.

**Exact stacked parent:** B1-77 branch `work/b1-77-windows-pg-version-content-race-fail-closed`, commit `e02229502d664a3594174886752e794a3a43edaf`. This branch does not rewrite the B1-77 parent and must remain a Draft PR. No main merge.

## Source-level defect and RED proof

The existing Windows PostgreSQL worker-quiescence helper lowercases paths and converts slashes but does not recognize Windows extended-length drive prefixes (`\\?\C:\...`), and accepts whitespace-only or ambiguous CIM `ExecutablePath` values as foreign processes. A false clean snapshot can then produce an `already-stopped` receipt without proving the pinned binary is absent.

On the authorized Mac with Node 26 and Vitest 5, three new synthetic regressions were **RED** on the exact B1-77 parent: **30 PASS / 3 FAIL / 1 SKIP**. The failing cases covered whitespace-only CIM paths, dot-segment executable paths, and unsupported device namespaces. The extended-length drive alias test is Windows-only.

## Narrow mitigation

Normalize Windows extended-length drive/UNC paths before comparing with the pinned executable. Reject blank, whitespace-padded, relative, dot-segment, device-namespace, or otherwise ambiguous paths instead of classifying them as foreign. Preserve two consecutive independent clean snapshots, bounded verification, privacy-safe constant errors, owned-fixture retention, and the prohibition on terminating processes. No production server behavior changes.

## Objective receipts

- Authorized Mac Node 26 / Vitest 5, one worker, 1024 MiB heap: **33 PASS / 0 FAIL / 1 SKIP** (Windows-only prefix case skipped).
- Targeted TypeScript 7 strict `--noEmit` for the changed helper under 768 MiB: **EXIT 0**.
- `git diff --check`: **PASS**.
- Native Windows focused regression: pending, no claim of success until observed.
- Native Windows read-only admission before this change: C 6.29 GiB, D 12.18 GiB, free RAM 5.50 GiB, 0 postgres.exe, 21 node.exe. No heavy build or real PostgreSQL test was attempted.

## Remaining gates

Synthetic tests do not prove exact PID/parent/creation-time ownership, #234 real Windows multi-suite no-orphan teardown, #237 packed-server startup/18-stage Better Auth HTTP, Chromium, offline agent, installers, Linux, security/privacy, or copy-first license/NOTICE provenance. **Release NO-GO**. No Actions enablement, npm pack, publishing, deployment, merge, paid compute/models/cloud, customer data, retained-fixture deletion, or foreign process termination.
