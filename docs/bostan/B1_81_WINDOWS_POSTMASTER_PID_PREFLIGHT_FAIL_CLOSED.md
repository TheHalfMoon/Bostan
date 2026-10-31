# B1-81 — Fail closed on malformed Windows PostgreSQL postmaster.pid before pg_ctl

**Scope:** STRICT PRIVATE / ZERO COST / NONPUBLISHING / TEST SUPPORT ONLY. **Release:** NO-GO.

**Exact stacked parent:** B1-80 Draft PR #335, branch `work/b1-80-windows-pgctl-preflight-before-stop`, head `68d49489bbbbb9cee6d9e0a6b11b1611ac67b065`. This change is intended for a new stacked Draft PR only. No merge to main.

## Reproduced defect

The existing helper `stopOwnedWindowsEmbeddedPostgres` used `lstatSync` to verify that `postmaster.pid` was a regular file, but never inspected the PID line before calling the injected/native `pg_ctl.exe ... stop` runner. A synthetic marker with zero bytes or invalid/non-numeric content could trigger a shutdown attempt.

A regression was added on the exact B1-80 parent. With an empty synthetic PID marker, the runner was invoked, removed that synthetic marker, and the helper resolved `stopped`, contrary to the expected fail-closed rejection. **Mac Node 26 / Vitest 5 RED:** 39 passed, 1 failed, 1 skipped. No real PostgreSQL process was stopped.

## Narrow fix

- Validate the first line of `postmaster.pid` as a bounded, positive decimal PID before the shutdown runner can execute. Reject empty, missing-newline, nonnumeric, zero, negative, whitespace-prefixed, escaped-newline, and oversized PID fields.
- Read at most 32 bytes and reject markers larger than 4096 bytes. Use `lstat` and `fstat` on the opened file to reject an obvious file-identity replacement, and compare size and modification time after reading.
- Keep the previous behavior for an absent PID marker: inspect pinned-binary processes, require two clean snapshots, and check marker/cluster identity again. A newly reappeared marker remains an error even if its contents are malformed.
- Preserve constant diagnostic strings: do not log PID contents, paths, process command lines, secrets, or environment variables.
- Correct one existing synthetic test marker that contained literal backslash-n instead of a real newline.
- No production server code, foreign process termination, retained-fixture deletion, template-cache reenablement, or cloud/model work.

## Objective evidence

- Authorized Mac, exact isolated B1-80 worktree with existing dependency links, Node 26, Vitest 5, one worker: **RED 39 PASS / 1 FAIL / 1 SKIP** before the fix.
- After fix: **40 PASS / 0 FAIL / 1 SKIP** (41 focused tests).
- Targeted `tsc --noEmit -p packages/db/tsconfig.json --pretty false`, TypeScript 7: **EXIT 0**.
- `git diff --check`: **PASS**.
- Windows native tests **not claimed** in this phase. Desktop Commander returned a Windows device with the expected hostname but a device ID different from the previously explicitly authorized ID; no Windows filesystem changes or real PostgreSQL work were performed.
- Mac contained unrelated PostgreSQL processes; they were not touched. Only newly created synthetic fixtures were removed by their own test helper.

## Limits / next proof

A syntactically valid PID marker is **not** cryptographic ownership or proof that the PID belongs to the pinned PostgreSQL binary. A concurrent file replacement after validation remains a race. The stronger requirements are explicit per-suite process PID/parent/creation-time attribution, real native Windows two-suite no-orphan proof (#234), packed runtime startup and 18-stage Better Auth/HTTP (#237), Chromium, offline agent, installers, Linux, privacy/security, and copy-first license/NOTICE qualification.

**Release NO-GO.** Do not merge main, enable Actions, publish/deploy/release, npm pack, use paid models/compute/cloud or customer data, kill foreign processes, delete retained QA fixtures, or run heavy Windows tests without resource admission and positive diagnosis.
