# B1-196 — Pin the native Windows PostgreSQL process inspector to OS PowerShell

Date: 2026-11-02 (Asia/Riyadh). **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO**.

## Concrete issue

The test-only Windows PostgreSQL stop helper `packages/db/src/windows-embedded-postgres-stop.ts` called `execAsync("powershell.exe", ...)` for its read-only CIM process identity inspection. Because the command was a **bare executable name**, the child-process API searches the operator's `PATH`. In a synthetically isolated Linux Node22 subprocess with an executable test file named `powershell.exe` placed in an otherwise private temporary `PATH`, invoking this bare name executed the synthetic file. This proves the lookup behavior, not execution of actual Windows PowerShell or any real PostgreSQL workload. A compromised executable found by PATH could undermine process identity evidence or execute untrusted code when the native Windows QA is permitted again.

## Implementation

Added `packages/db/src/windows-postgres-inspector-binary.mjs`, a standalone, test-only, fail-closed OS PowerShell resolver. It accepts only the direct drive-rooted `<drive>:\Windows` conventional `SystemRoot`, constructs the absolute `System32\WindowsPowerShell\v1.0\powershell.exe`, and lstat-inspects every ancestor directory and the executable. It refuses non-Windows, relative, UNC, device, nested lookalike, alternate-stream, malformed, linked, missing or non-file paths, with a fixed bounded error message that does not expose untrusted input. The existing PostgreSQL actual CIM inspector now invokes `execAsync(resolveWindowsPostgresInspectorBinary(), ...)` **inside its existing try/catch**, preserving the conservative process-scan error behavior and never resolving a bare PowerShell name via PATH. No PostgreSQL termination, process-snapshot semantics, user environments or production authentication logic changed.

A NodeNext declaration file accompanies the helper. The helper intentionally resides in the database test support package rather than importing from repository-root QA scripts, which may not be included when the database package is installed independently. A similar already-tested path-resolution policy existed in the root private Windows HTTP QA scripts; this closes the remaining bare-PATH use in the embedded PostgreSQL stop helper.

## Evidence

- Reproduced old bare-PATH executable lookup in an **exclusively owned Linux Node22** fixture; the synthetic `powershell.exe` emitted the expected marker. The temporary fixture was removed immediately. No actual system binary was replaced or accessed.
- Actual Linux Node22 test runner on an independently blob-hash-verified helper and its **8 regression tests**: **8/8 PASS, 0 skipped, exit 0**. Covered canonical direct OS binary, alternate drive root, nested lookalike, UNC/device/alternate stream, malicious and missing path components, linked/missing executable, wrong platform/injected arguments, and redacted failure diagnostics.
- Targeted isolated **TypeScript 5.8 NodeNext --strict --noEmit** type resolution of the `.mjs` helper through its `.d.mts` contract: **exit 0**. This does **NOT** qualify full root TypeScript7 compilation.
- Independently fetched exact GitHub `windows-embedded-postgres-stop.ts` after the change: the actual CIM inspector imports and invokes `resolveWindowsPostgresInspectorBinary()` and no longer contains the bare `execAsync("powershell.exe"` call. A repository-integrated contract test is committed for future installed-workspace qualification; full repo Vitest and native Windows execution have NOT been run.

Exact private GitHub files:

- `packages/db/src/windows-postgres-inspector-binary.mjs` SHA `f308295b1da6a1f0a6bcf6575ec16b538f0f02a7`.
- `packages/db/src/windows-postgres-inspector-binary.test.mjs` SHA `5e8978978d66d2c863d3199d884483bc85961f79`.
- `packages/db/src/windows-postgres-inspector-binary.d.mts` SHA `09a7dff3f42d812206a3b91026f0e4fc2d7141d6`.
- `packages/db/src/windows-postgres-inspector-integration.test.mjs` SHA `b7886d856f0eb9459b4cc0820f83c38ab938f4bf`.
- `packages/db/src/windows-embedded-postgres-stop.ts` SHA `ca58999126b36c2fe8c65c2693db0d8ab814f77c`.

## Residual risks / strict release gates

The resolver uses the conventional validated `SystemRoot`, not a native kernel `GetSystemDirectoryW` ownership attestation, and lstat-then-exec is not an atomic guarantee against concurrent privileged filesystem replacement. Treat this as removal of operator-PATH ambiguity, not a universal OS executable trust proof.

**No actual native Windows PG/Powershell test in this wave.** The Desktop Commander provider previously explicitly reported **monthly tool quota exhausted**; paired/online status alone is not evidence that access was restored. Do not retry, reconnect or work around that quota. Previously staged exclusive `D:\Bostan-B212-qa` PostgreSQL asset copy remains **retained and unverified for final inventory/ownership/hash**; no actual initdb, server, crash, foreign process termination or cleanup was performed here.

Critical #234 genuine native repeated Windows forced-crash PostgreSQL `io_worker` zero-orphans proof and #237 clean owned fully installed compiled Windows HTTP with Better Auth session/first-admin/tenant/roles plus Chromium are **still OPEN**. Full TS7/Vitest, macOS/Linux live PostgreSQL cache, Linux sandbox, cross-OS installers, consent/privacy/tenant/security/license provenance remain unqualified. Keep project private, no main merge, Actions, publish, deploy, paid tooling or release. **NO-GO**.
