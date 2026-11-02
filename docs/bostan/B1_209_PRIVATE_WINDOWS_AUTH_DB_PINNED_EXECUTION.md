# B1-209 — Private Windows auth/DB runner executable and environment boundary

**Private draft only. Release NO-GO.** Direct parent: B1-208 PR #465 at `a04008856f3aa2bdab1645e3e3bc6645652ce06d`.

## Source-backed defect

The pre-existing `scripts/bostan-private-windows-auth-db.mjs` spread nearly all operator `process.env` into test subprocesses, removing only selected token prefixes. It resolved `powershell.exe`, `pnpm.cmd`, and `cmd.exe` via inherited search paths or ambient `ComSpec`. That is not a bounded executable identity or credential boundary for a native test harness.

## Repair

The runner now preflights ordinary unlinked Windows drive/Windows/System32/cmd.exe paths and the pinned Windows PowerShell binary. It creates an allowlisted child environment with OS-only PATH, fixed ComSpec/PATHEXT, checkout-wave-owned TEMP/HOME/profile directories, offline flags and no inherited cloud credentials, database URLs, NODE_OPTIONS or operator executable paths.

It invokes the running absolute Node executable with checked checkout-local TypeScript and Vitest package entrypoints, not a shell or pnpm resolved via PATH. The original plugin SDK build is decomposed into shared TypeScript build, shared notice asset copy and SDK TypeScript build. Server auth/first-admin and DB migration/reset Vitest selections remain explicit. Before and after those steps, a pinned PowerShell script performs the existing read-only three-snapshot PostgreSQL orphan check. All executable and package paths are inspected before any subprocess, including symlink/junction scope refusal, in-checkout physical package resolution, package name verification, ordinary unlinked entrypoint checks, and refusal on missing tools. No dependency installation, process termination, or release action is added. PowerShell execution-policy bypass is not requested.

## Verification (isolated Linux Node 22.16.0)

- Exact tested helper Git blob: `e879b80f0497dc91374c99b7e7fa560618ac8f3e`.
- Exact tested nine-case `node:test` Git blob: `ebf864ce6124b67db2d424a5ebfbd25080ef92dc`.
- Actual modified runner Git blob: `0b03091c84f89f463ef7d0ea37905b822d0d2660`; local reconstructed source hash matched, `node --check` passed.
- Nine isolated filesystem tests **9/9 PASS**, zero skips, exit 0. They cover pinned command order, secret/PATH/profile noninheritance, inconsistent OS roots, foreign linked packages, forged package identity, linked workspace scopes, linked Node binary, absent CLI and nested TEMP.
- Test fixtures use synthetic directories and fake command files only; no subprocesses, Windows host, real PostgreSQL or Chromium were started. This is **not** native Windows qualification and not a claim that the actual build/tests passed.

## Limits and NO-GO

A checked path can be swapped by a privileged concurrent actor after inspection; this is not kernel-level executable attestation. Direct CLI invocation may expose native compatibility differences from pnpm and must be qualified on a legitimately accessible Windows host with fully installed owned dependencies. Root/server TS7 and Vitest, repeated genuine Windows PG18.1 forced-crash io_worker zero-orphan (#234), compiled localhost authenticated HTTP/Better Auth/Chromium (#237), Mac/Linux PG cache, Linux bwrap, installed three-OS E2E, security/consent/privacy/tenant and donor LICENSE/NOTICE provenance remain open.

Remote Desktop Commander monthly quota was reported exhausted and was not retried or bypassed. Retained `D:/Bostan-B212-qa` native assets and all foreign/user QA remain untouched. No Actions, main merge, publication, deployment, paid provider, customer records or donor provenance modification.
