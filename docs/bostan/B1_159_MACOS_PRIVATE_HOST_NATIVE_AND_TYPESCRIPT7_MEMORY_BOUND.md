# B1-159 — macOS source-native private admission and TypeScript 7 resource boundary

**Date:** 2026-11-01 Asia/Riyadh  
**Repository:** private `TheHalfMoon/Bostan`  
**Exact tested commit:** `4302ac0799290175039536eed956593ae2c8cee7` (PR #415)  
**Parent:** PR #415, `work/b1-158-macos-real-pg-auth-qualification`  
**Status:** PRIVATE DRAFT ONLY; **release NO-GO**.

## Scope and environment

Executed against the actual checked-in Bostan source in an existing authorized, clean, dependency-installed macOS arm64 QA worktree. Node v26.0.0, pnpm, Vitest v5.0.3 and native TypeScript compiler v7.0.2 were already installed. No new clone, package installation, GitHub Actions, paid provider, customer data, production database, release or deployment. A detached checkout was temporarily moved to the exact tested commit and returned to its original clean commit after **each** execution.

## Source-native results

| Invocation | Result | Qualification boundary |
| --- | --- | --- |
| `node scripts/bostan-private-preflight.mjs` | **PASS** | Exact checked-in private preflight, not the full product |
| `pnpm run test:bostan-admission` | **58/58 PASS**, 0 fail/skip | Four authored Node test files including checked-out docs/UI admission |
| `pnpm run test:bostan-upgrade-wire` | **35/35 PASS**, 0 fail/skip | Actual Node HTTP upgrade loopback wire tests against the checked-in admission module |
| `server/node_modules/.bin/vitest run src/__tests__/private-hostname-guard.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1` | **83/83 PASS**, 0 fail/skip, exit 0 | Exact checked-in server Vitest 5 suite on Mac; HTTP/private host regression, not a full booted server |
| `server/node_modules/.bin/tsc --noEmit --pretty false` | **NOT QUALIFIED**; terminated for memory protection | Native TypeScript v7.0.2, but no complete typecheck result |

The private preflight, 58 admission tests and 35 wire tests exited successfully in one bounded invocation. The 83 server Vitest tests exited successfully in a separate single-worker invocation (Vitest reported 19.00 seconds, 1 test file passed). All results are for the **same exact** source commit. Earlier PRs already qualified overlapping subsets on other platforms; this record does not claim new coverage for those previously qualified tests.

## TypeScript resource guard — no false PASS

Before attempting the server-only TypeScript 7 check, macOS reported **36% system-wide free memory**. The native `tsc --noEmit --pretty false` process was still active after more than 90 seconds, while free memory dropped to **18%**. The authorized run stopped **only its own verified TypeScript compiler process** to protect the shared 8 GiB Mac. The command exited **137**. This is an intentionally aborted resource-bound attempt, **not a compiler pass, a compiler error, or a measured project-wide typecheck result**. No other processes or files were deleted or terminated.

The original detached QA commit `88e0274412c2e6cbadd07534960b20184907f291` was restored after the abort and after the later Vitest run, with clean `git status --porcelain`. System free memory recovered to 31% before the bounded Vitest run. Existing dependencies, user services, and other checkouts were left intact.

## Remaining mandatory qualification

- Re-run TypeScript 7 with a controlled, adequately provisioned isolated host, without assuming an 8 GiB Mac can finish the full server check.
- Full root `test:run`, all package typechecks and broader Vitest suites are **not** qualified by these scoped results.
- Windows issue #237: real compiled/booted authenticated loopback HTTP, Better Auth and Chromium journeys remain open.
- Windows issue #234: genuine repeated/stress/forced-crash PostgreSQL `io_worker` zero-owned-orphan evidence remains open.
- Four genuine unprivileged rootless Linux `bwrap` cases, installed Windows/macOS/Linux journeys, side-effect consent, tenant isolation, and legal attribution remain unqualified.

No production code was changed in this evidence-only PR. Keep the entire stack private, draft, unmerged; do not enable Actions, publish, deploy or release.
