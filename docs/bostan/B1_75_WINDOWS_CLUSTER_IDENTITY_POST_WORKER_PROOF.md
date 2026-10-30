# B1-75 — Preserve Windows PostgreSQL cluster identity through worker verification

**Scope:** Private, zero-cost, nonpublishing, test-only Windows PostgreSQL teardown.
**Stacked parent:** Draft PR #329, exact head `4f58b7391621595f4078932e1a254b739f978a55`.
**Release decision:** NO-GO.

## Reproduced defect (source-level synthetic tests)

The shutdown helper validated the scratch directory at entry and then performed two independent PostgreSQL-process snapshots. If another actor renamed the directory, or replaced it with a new directory containing a fresh `PG_VERSION`, between the snapshots, the final absent `postmaster.pid` check still returned `already-stopped`. The same problem affected the `stopped` return after `pg_ctl`. This is a false teardown-success receipt, **not evidence that a real Windows PostgreSQL process was orphaned**.

On exact parent #329 with only the two new regressions added, native Mac Node 26 / Vitest 5 returned **19 PASS, 2 FAIL**: both new tests resolved `already-stopped` instead of rejecting.

## Narrow mitigation

Capture the validated scratch directory's `lstat` identity at entry. Before either success return, require the directory to remain an ordinary directory at the same canonical location, with matching device, inode and birth time, and require `PG_VERSION` still present. Any absent, replaced, inaccessible or ambiguous identity rejects with a constant privacy-safe error; the helper does not kill processes or delete retained fixtures. The existing PID marker and pinned-binary two-snapshot checks remain.

## Objective receipts

- Native Mac Node 26, Vitest 5, single worker, capped 1024 MiB: **23 PASS, 0 FAIL** on focused Windows teardown policy tests, including missing, replaced, post-stop replaced, and vanished `PG_VERSION` cases.
- Targeted TypeScript 7 strict no-emit on the changed helper with explicit workspace Node type roots and 768 MiB heap: **EXIT 0**.
- `git diff --check`: **EXIT 0**.
- Windows read-only admission at 2026-10-30 ~22:07 Asia/Riyadh: C 7.11 GiB, D 12.22 GiB, RAM 3.05 GiB, 0 `postgres.exe`, 16 `node.exe`. Heavy Windows PostgreSQL/Chromium/build not run due to low free RAM and existing workloads.

## Limits and remaining gates

This is synthetic filesystem-race proof on Mac, **not** native Windows multi-suite PostgreSQL/worker ownership proof. Inode/birthtime reliability on the actual Windows fixture remains to be measured. The check is not atomic after the final observation; exact owned PID/parent/creation-time graph and independent no-orphan #234 remain necessary. #237 packed Windows HTTP/Better Auth, Chromium, offline agent sandbox, installers, Linux, security/privacy and licenses/NOTICE provenance remain NO-GO. The divergent #326 child of #325 was not cherry-picked; this narrowly covers the directory-identity post-proof gap on the later #327 → #328 → #329 chain.

No main merge, GitHub Actions enablement, npm pack, publish, deploy, release, paid model/compute/cloud, customer data, foreign process termination or unrelated disk cleanup.
