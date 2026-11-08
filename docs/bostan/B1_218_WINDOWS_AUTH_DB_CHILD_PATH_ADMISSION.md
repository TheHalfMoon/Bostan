# B1-218 — Native Windows auth/DB captured-child path admission

**PRIVATE DRAFT ONLY. RELEASE NO-GO.** Parent PR #474 exact head `9a40507bf9ba0f76362ddebb1664f93a72c61566`.

## Source-backed issue

The B1-217 captured-child helper used host-native `node:path.isAbsolute` for `command.binary` and `command.cwd`. On Windows, absolute paths can include UNC shares, device namespaces, and aliases; an absolute path is not proof of a canonical, directly drive-rooted executable or checkout. A direct helper caller could bypass the intended local-only path policy. The existing B1-209 execution planner already supplies pinned absolute local paths and verifies executable/workspace ancestors; this is defense-in-depth, not evidence that the existing runner executed foreign programs.

## Repair

When running on Windows, or when validating a synthetic environment containing Windows `SystemRoot`, both binary and working directory must be canonical direct-drive Windows paths. Reject UNC/device namespaces, noncanonical dot segments, mixed separators, ADS colons, control characters, reserved device components, and trailing dot/space before spawn. Windows execution without `SystemRoot` is refused. Minimal Linux Node synthetic tests without a Windows root retain POSIX absolute paths. No shell, bounded child stdout/stderr, allowlisted offline env, and final read-only PostgreSQL orphan gate remain unchanged. This is a string-level preflight, not filesystem ownership or atomic process attestation.

## Actual isolated test-first verification

Host: Linux, Node 22.16.0. Against the exact B1-217 helper Git blob `fe148af0eff779a9b47682f1eb2d205df830edbf`, new six-case tests yielded **4 PASS / 2 expected RED**: canonical Windows paths were rejected on Linux, while POSIX absolute paths with a synthetic Windows root were accepted. With the repaired helper, the six new tests plus the existing seven captured-child tests (including a real local synthetic Node process and >1 MiB output), seven boundary tests, and seven offline-env tests yielded **27/27 PASS**, zero skips, exit 0. `node --check` passed for all six locally used modules.

Exact locally tested Git blob hashes:
- Captured-child helper: `75d47346d46b6e3d3dd20147a92f75fde2ff9d8c`
- New path regression suite: `fe5b4ff63e678665ccf8e5069ffaf73b562e01ff`
- Updated boundary suite: `4a2f09da3297a54152e680e198d64e90c5b1b4d4`
- Updated offline environment suite: `6f62c7af109e416e1e8bc645ce4a34a9b5727273`
- Unmodified captured-child suite: `c1fc43ba317b8dda4277770a497370d1b4813eb0`
- Unmodified orchestration helper: `767b3d09bdd2d717d7b58f1571810879bdf54b09`

## Still unqualified

No native Windows Node24/PG18.1/PowerShell/Chromium or full root/server TS7/Vitest. No repeated deliberate Windows PostgreSQL18.1 forced-crash io_worker zero-orphan #234; no installed compiled authenticated localhost HTTP/Better Auth/Chromium #237; no real Linux bwrap, Mac/Linux PG cache, or installed Windows/macOS/Linux E2E. Remote Desktop Commander quota was not retried or bypassed; retained `D:/Bostan-B212-qa` was not touched. No donor LICENSE/NOTICE/provenance changes, publication, paid provider, foreign-process termination, or cleanup. **RELEASE NO-GO.**
