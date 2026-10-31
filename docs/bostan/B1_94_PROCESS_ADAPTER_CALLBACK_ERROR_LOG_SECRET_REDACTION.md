# B1-94 — Fail closed on process-adapter callback exception logging

Date: 2026-10-31. STRICTLY PRIVATE / ZERO COST / NONPUBLISHING. Proposed stacked parent: B1-93 Draft #348, exact parent head to verify at push. Do not merge main or enable Actions.

## Reproduced leak (RED before patch)

`server/src/adapters/utils.ts` wired `runChildProcess`'s `onLogError` callback to `logger.warn({ err, runId: id }, msg)`. An adapter log append callback can reject with arbitrary user/provider-controlled error text; Pino serializes `err.message` and its stack. A real local Node child wrote a harmless stdout chunk, and the synthetic onLog callback threw `Error("PRIVATE_UNKNOWN_SECRET_194")`. The initial assertion was corrected to inspect the Error object's non-enumerable `.message` (JSON.stringify(Error) would be a false negative). The corrected pre-fix test failed as expected, demonstrating the exact synthetic token in the warning payload. No database, browser, remote model, customer data or external network was involved.

## Minimal change

The server-only adapter shim now ignores the untrusted exception and diagnostic text and emits a fixed `process adapter child callback failed` warning with the host-owned run ID. This covers both asynchronous stdout/stderr onLog failures and child onSpawn metadata callback failures. Child command, args, environment, stdout/stderr capture, timeout, process lifetime, cleanup, and error accounting remain unchanged. It intentionally reduces diagnostics; it does not prove process stdout/stderr or other adapter paths are safe for arbitrary secrets.

## Objective QA

- RED: 1/1 synthetic callback exception privacy test failed on exact prior source (after avoiding JSON.stringify(Error) false negative).
- GREEN: 2/2 synthetic callback tests passed with real local Node children, including stdout callback and rejected onSpawn callback.
- Mac Node 26 / Vitest 5 with one worker and capped heap: 70/70 PASS across adapter registry, adapter routes, process execute, process environment, and the two new callback tests; 0 FAIL, 0 SKIP.
- Targeted strict TypeScript 7 `--noEmit --ignoreConfig` PASS; `git diff --check` PASS.
- QA ran in a separate owned temporary checkout using already-present local pnpm dependencies; no new dependency installation. These are source tests, not native Windows packed-runtime/PG/Chromium qualification.

## Outstanding NO-GO

Windows packed startup/concurrent-write reliability, native Windows PostgreSQL multiple-suite no-orphans proof, Linux, installers, full security/privacy authorization and effect budgets, license/NOTICE/provenance/branding and release checks remain open. Do not merge main, publish/deploy/release, npm pack, enable Actions, use paid inference or customer data. Do not clean retained fixtures or terminate foreign processes.
