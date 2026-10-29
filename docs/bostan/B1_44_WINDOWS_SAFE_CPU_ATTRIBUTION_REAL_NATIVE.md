# B1-44 — Bounded Windows packed import CPU attribution (no real PostgreSQL)

Date: 2026-10-29. PRIVATE, ZERO-COST, NONPUBLISHING. Stacked on B1-43 Draft PR #297 exact head `3aebe4a318531a860802bfc996733804503b63e7`. No `main` change.

## Why this is needed

B1-42's bounded Windows packed import proof observed only `static_import_start`; the complete real Windows PostgreSQL/HTTP path previously timed out at 180 seconds and had uncertain fixture cleanup. Its CPU output was only four broad buckets, including a large `other` group, insufficient to attribute CPU time to workspaces, dependencies or V8 runtime.

## QA-only engineering

Added `scripts/bostan-private-windows-cpu-profile-summary.mjs`, a deterministic bounded parser that consumes an **owned local V8 CPU profile** produced by the existing no-real-PostgreSQL probe and outputs numeric sample counts grouped into idle, program, GC, packed runtime, third-party dependency, Node internals, workspace, other script and unattributed; it reports at most eight dependency package identifiers (no original file paths, line positions, raw function names, raw source URLs or profile metadata).

Rejects malformed or overlarge node/sample arrays; limits package identifiers to ASCII package grammar. The parent probe still owns and destroys its one ephemeral, loopback-only dummy TCP database stub and its exact spawned child, and removes only its owned temporary profile directory. The new parser explicitly marks startup/release **not qualified**, and missing/corrupted CPU profiling now causes a nonzero diagnostic exit after cleanup.

## Actual Mac and native Windows execution

Source branch is exactly B1-43 #297 plus QA-only parser/test/probe; no production code changes.

- macOS arm64: Node syntax **PASS**, 2/2 new deterministic parser tests **PASS**, `git diff --check` **PASS**.
- Authorized real Windows 11 `Abdulaziz` device: isolated SHA-owned `D:\Bostan-B144-qa` at tested commit `ab2eca1c6b81c2e824526b3a884975a558cf20f4`, isolated matching `D:\Bostan-B144-temp`. Frozen previously compiled runtime JS and dependency artifacts copied only into that new worktree (unchanged product source). Rebundled with native Windows Node 24.19.0: **2366 inputs, 119 chunks**, exit 0 in 62.08s. Native SHA256 manifest admission **PASS**. Node parser tests **2/2 PASS**.
- Native resource preflight: C: **8.46GiB free** (requires 2), D: **8.88GiB free** (requires 6), RAM **3.69GiB free /15.72GiB total** (requires 2/6), all admitted.
- Real bounded diagnostic `node scripts/bostan-private-windows-packed-import-probe.mjs --run` **EXIT 0 in 37.45s**. Only `static_import_start` observed, `child_exited`; child closed without force; **no real PostgreSQL**; exact probe scratch automatically removed.
- Actual V8 leaf-profile sample total **9,478**: idle 1, program 11, GC 271, packed runtime 439, third-party 1450, Node internals 3019, workspace 0, other script 0, **unattributed 4287**. Top dependency names by **leaf sample count**, not absolute startup cost: `zod` 748, `@cursor/sdk` 234, `css-tree` 54, `drizzle-orm` 53, `jsdom` 27, `@vladfrangu/async_event_emitter` 21, `discord-api-types` 13, `undici` 13.
- Read-only post-run: zero processes identified with the B144 QA or temporary path; only the B144 outer marker remains. No foreign service or data affected. Mac/Windows isolated worktrees are intentional QA assets, not release packages.

This attribution is **not a root-cause finding**: sampled leaf counts are not inclusive timing, and 45% of samples are not yet attributable to named scripts. Do not claim `zod` or `@cursor/sdk` caused the Windows stall.

## Remaining release blockers (NO-GO)

Windows full real Better Auth/PostgreSQL/HTTP first-admin startup (#237) and multi-suite orphan cleanup (#234) remain RED/uncertified. Next diagnostic should resolve unattributed V8 buckets and lazy/eager import effects **without rerunning unsafe full 180-second DB QA**. A genuine zero-cost agent task, native installers, Linux, full semantic typechecks, privacy/security/provenance/licensing gates also remain open. Private Draft only; no merge into protected main, publish, deploy, npm pack, Actions enable, paid models, real customer data, or unrelated process/files deletion.
