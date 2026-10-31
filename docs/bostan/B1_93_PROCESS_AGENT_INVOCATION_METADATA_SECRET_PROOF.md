# B1-93 — Protect process invocation metadata from unknown secret-bearing values

Date: 2026-10-31. STRICT PRIVATE / ZERO COST / NONPUBLISHING. Exact stacked parent B1-92 private Draft #347 at `240460bb0c9702d8768019102d26f803c2b28e20`. No protected-main merge.

## Security gap — demonstrated RED before the fix

B1-92 redacted process-agent setup checks and pre-spawn exception messages, but the production `process` adapter's **`onMeta` adapter.invoke event** still sent the fully resolved command path, working directory, untrusted command arguments and arbitrary user-configured environment values to the heartbeat event recorder. That event is persisted and can be streamed to company viewers; generic secret-pattern redaction only covers recognizable tokens and secret-key names, not unknown opaque values in `--data` arguments or ordinary environment variables.

Added a synthetic regression to `server/src/adapters/process/execute.test.ts` **before changing implementation**. It supplied a valid local Node command with an arbitrary sensitive command argument, a normal-looking environment key containing an unknown secret value, plus cwd/path, then made `onMeta` reject *before child spawn*. The original source test was **RED**, displaying the command, cwd, argument secret and environment secret in the captured metadata. No private customer tokens, real model calls or database were involved.

## Minimal production change — metadata only, no change to execution

In `server/src/adapters/process/execute.ts`, retain the original configured process command, args, cwd, env, managed runtime token isolation, PATH validation, timeout, cleanup and actual call to `runChildProcess` unchanged. Its **telemetry-only `onMeta` event** now emits fixed descriptive strings in place of the command and cwd, one fixed placeholder per original command argument, and **an empty env map**. This retains adapter type and argument count while ensuring no unknown env value, private path or command contents can enter the `adapter.invoke` event. The operator's deliberately configured process command and all its environment remain effective during actual execution. This deliberately reduces diagnostic observability; the actual agent configuration and local execution are not changed.

This does **not** claim child process stdout/stderr, process callback errors, exported execution configuration, or arbitrary agent effects are fully sandboxed; those require separate authorization and data-flow reviews.

## Executed evidence (Mac local source QA)

- Source RED demonstration: **1/2 process execute tests failed** before the patch, exactly because `onMeta` contained arbitrary credential-like values.
- After fix: **5/5 focused tests PASS**, including a **real native Mac local Node child process** whose synthetic environment value reached the actual child, produced the expected stdout and exited 0, while the invocation metadata contained none of the configured values, executable pathname or cwd. No PostgreSQL or browser.
- Broader Mac Node26/Vitest5 compatibility test run, one worker and 1280MiB heap: **68/68 PASS** over adapter registry (33), adapter routes (30), process execute (3) and process setup check (2). **Targeted strict TypeScript noEmit PASS**, diff check PASS.
- No new dependency installation, release packaging, remote provider invocation, paid model, user data or unowned system process changes.

## Release remains NO-GO

A sanitized metadata event is not an untrusted execution sandbox or permission/effects consent mechanism. Full Windows packed startup and PostgreSQL/Chromium E2E, native Linux/installer qualification, sustained concurrency, release security/privacy, NOTICE/licensing/provenance/branding remain open. Keep repo PRIVATE, stacked PR DRAFT; no main merge, Actions enablement, deployment, npm publishing or release.

## Native Windows check on the same committed source

The existing authorized Windows 11 device, in its strictly disposable `D:\Bostan-B144-qa` checkout, fetched the **exact committed candidate head** `f9e75b0ea3a1dd80934e25ba209d1eabfdc60060`. Read-only admission found **6.08 GiB free RAM**, **12.15 GiB D: free**, no pre-existing PostgreSQL; only a small native Node test was launched (not the heavy Windows Postgres/Chromium qualification).

With native Windows Node and pre-existing pinned Vitest 5, `node .\node_modules\vitest\vitest.mjs run src/adapters/process/execute.test.ts src/adapters/process/test.test.ts --maxWorkers=1 --no-file-parallelism` **EXIT 0, 5/5 PASS, 0 skipped** in 13.71 seconds. This includes the real native Windows local child execution with original synthetic argv/env and strictly redacted `onMeta` output, as well as the pre-spawn exception and test-environment privacy gates. No new installation, remote model, DB, browser or real user data was involved. Independent postrun read-only scan observed **0 PostgreSQL** and **0 B144-owned Node** processes. This is native Windows **process-adapter focused QA only**, not a Windows installer/packed-server release qualification.
