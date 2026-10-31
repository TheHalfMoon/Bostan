# B1-86 — Fail closed on ambiguous Windows CIM process creation dates

Date: 2026-10-31. **STRICTLY PRIVATE · ZERO COST · NONPUBLISHING · STACKED DRAFT ONLY.**

## Exact admission and scope

Based on B1-85 Draft PR #340, branch `work/b1-85-windows-cluster-identity-pre-shutdown`, exact parent `f1603961e06efa50f9951991d090f105cb157913`. At admission, live GitHub repository visibility was `private`; `main` remained `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a`, `protected:false`; Actions were disabled. B1-85 and B1-84 were both open, unmerged, mergeable Draft PRs. No main merge or release operations.

The connected Mac ID was `93340dea-e68f-4d6f-9aea-d8fb64bae04a`; connected Windows ID `62835bd9-9ffe-4bd5-9010-6ac23b2d7223` did **not** match the explicitly authorized native Windows ID `6641fb27-1a94-40b7-a76d-06e5e61a49af`. No Windows execution or real PostgreSQL stop was attempted. Mac tests used a bounded Node heap (1024 MiB), one Vitest worker, and isolated synthetic fixture directories. Existing QA trees, other processes and retained fixtures were not touched.

## Reproduced defect before repair

The native PowerShell inspector constructs `CreationDate` using `ToUniversalTime().ToString('o')`, an ISO 8601 UTC round-trip string. The TypeScript validator previously accepted **any** string for which `Date.parse()` was finite. JavaScript parses shorthand such as `"1"` as a date and may normalize impossible calendar days such as `2026-02-31`. An ambiguous CIM row for a foreign `postgres.exe` could therefore pass the identity schema and, after two clean snapshots, produce an `already-stopped` receipt without a canonical process creation identity.

A new deterministic test on the **unchanged B1-85 source** used an injected fake process inspector returning a foreign executable with `CreationDate: "1"`. Baseline: **45 PASS / 1 FAIL / 1 SKIP**, with the failure explicitly reporting that the helper resolved `already-stopped` instead of rejecting the row. No native PowerShell, PostgreSQL process or shutdown command was invoked.

## Narrow repair and evidence

Validate a canonical UTC `YYYY-MM-DDTHH:mm:ss[.1–7 digits]Z` creation timestamp before accepting a process row. In addition to the shape, compare the parsed UTC date/time back against the source to reject calendar rollover. Keep the existing finite-date check and all conservative executable/PID identity checks. Preserve the PowerShell `o` format's seven-digit fractional seconds. This is limited to test-only Windows PostgreSQL teardown validation, not product authentication, production runtime or process termination.

Regression cases reject numeric shorthand, impossible February day, missing timezone, explicit non-UTC offset and date-only strings. A valid seven-digit UTC round-trip date remains accepted. On authorized Mac Node 26 / Vitest 5: **46 PASS / 0 FAIL / 1 SKIP** (47 total). Targeted TypeScript strict `tsc --noEmit -p packages/db/tsconfig.json`: **EXIT 0**. `git diff --check`: **PASS**.

## Explicit limitations — release NO-GO

This is **synthetic** process-schema validation, not real native Windows multi-suite PostgreSQL no-orphan proof (#234), and does not establish atomic ownership of processes or cleanup of a stale `postmaster.pid`. The packed Windows server startup, 18-stage Better Auth/HTTP (#237), Chromium, genuine no-cost offline agent, installers, Linux, security/privacy and copy-first license/NOTICE qualification remain open. The repository's `main` branch is still unprotected.

No merge to main, Actions enable, deployment, publish, release, npm pack, paid compute/models/cloud, customer data, deletion of retained fixtures or foreign-process termination.
