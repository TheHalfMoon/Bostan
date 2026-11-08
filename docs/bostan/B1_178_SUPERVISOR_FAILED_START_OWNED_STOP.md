# B1-178 — Fail-closed PostgreSQL recovery after a replacement start failure

Date: 2026-11-01 (Asia/Riyadh). Repository: private `TheHalfMoon/Bostan`. Direct parent: B1-177 PR #435 at `322e86eab13dd85231fb449caf28cb7dcf6a2bcb` (Windows PostgreSQL marker hardlink safety). B1-176 PR #434 remains its parent.

## Verified defect

`server/src/embedded-postgres-supervisor.ts` retried `createInstance().start()` after rejection without first stopping the just-created replacement. A failed start is not evidence that a native PostgreSQL process never launched; starting another replacement can leave the failed attempt alive. A concurrent `shutdown()` could also report completion without waiting for that replacement.

## Source repair

After an owned replacement's `start()` rejects, await that exact replacement's `stop()` **before** another recovery attempt. If stop rejects, record an unverified-stop error, invoke the existing exhaustion callback, prohibit further replacements, and make both `waitForRecovery()` and `shutdown()` reject. If shutdown is requested while cleanup is in flight, join that cleanup and return only after it fulfills. No global PID enumeration, signaling, process deletion, PostgreSQL cache cleanup, or changes to the initial-instance shutdown policy.

## Actual native test-first qualification

- Mac arm64, Node v26.0.0, Vitest v5.0.3, exact test-only commit `60857fda795dffc14ee2c4f3dd3be8ce21be1530`: **7 PASS / 3 RED**, exit 1. New regressions showed no stop before retry, false recovery success after rejected stop, and false shutdown completion while failed-start stop was pending.
- Mac arm64, exact final stacked source+tests commit `c031e0ccc7475d16f34fd198c26b374018fb7b63`: `cd server && NODE_OPTIONS=--max-old-space-size=1152 ./node_modules/.bin/vitest run src/__tests__/embedded-postgres-supervisor.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1` → **10/10 PASS, 0 skipped, exit 0**.
- Mac targeted TypeScript 7.0.2: `cd server && NODE_OPTIONS=--max-old-space-size=1152 ./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --types node --target es2022 --module nodenext --moduleResolution nodenext src/embedded-postgres-supervisor.ts` → **exit 0**. Initial exploratory invocations without `--ignoreConfig` or `--types node` exited 1 due CLI/config/type-environment setup, not source errors.
- Windows 11, Node v24.19.0, Vitest v5.0.3, exact final stacked source+tests commit `c031e0ccc7475d16f34fd198c26b374018fb7b63`, single worker and 1152 MiB Node heap cap → **10/10 PASS, 0 skipped, exit 0**. Pre-run free RAM approximately **6.15 GiB**.

Tests use synthetic `EventEmitter` and controllable Promise gates, not a real PostgreSQL process. There are **10 distinct test cases executed on each of two OSes**, not 20 unique tests. No native forced-crash, compiled server, or Chromium run is claimed.

The source and test blobs are identical to the Mac/Windows preliminary green commit `e8f46a4484d19d427390e8f5ab3822de3a03f786`; they were replayed without alteration onto #435, whose three changes are disjoint (`packages/db/src/windows-embedded-postgres-stop*` and its evidence). The final stacked commit was independently retested on both operating systems.\n\n## Worktree and release safety

- Existing Mac `Bostan-B142-qa` restored to original detached `88e0274412c2e6cbadd07534960b20184907f291`, clean.
- Existing Windows `D:\\Bostan-B111-qa` restored to original detached `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`, clean.
- No new clone, dependency install, real PG launch, foreign process termination, cache deletion, paid service, GitHub Actions, release, deployment, or main merge.

**Release remains NO-GO.** Issue #234 requires real owned Windows forced-crash io_worker zero-orphan proof; #237 requires fresh SHA-owned compiled Windows server and Chromium authenticated role/tenant journeys. Full TypeScript/Vitest, Linux rootless bwrap, installed cross-OS workflows, consent/tenant boundaries, and legal attribution are not qualified by this bounded repair.
