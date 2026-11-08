# B1-09 — Reject nested fake Windows roots and linked PowerShell ancestors

Date: 2026-10-28. PRIVATE Bostan, stacked on B1-08 Draft PR #260 at exact head `e074cd9fc3d3a0d09e3280626d49e623cb6aa7c7`. No main modification/merge, publication, deployment, GitHub Actions, paid cloud/models, customer data, or operator cleanup.

## Reproduced concrete B1-08 security gap

B1-08 removed the inherited PATH lookup for `powershell.exe` but validated `SystemRoot` by checking only that its **basename** was `Windows` and by calling `lstatSync` on the **leaf binary only**. In an isolated Linux Node 22.16.0 reproduction using the **exact B1-08 GitHub source blob** `52342edce9639b063596002aee45706534b579aa`, `resolvePrivateWindowsPowerShellBinary({platform:'win32',systemRoot:'C:\\Untrusted\\Windows',statBinary:()=>({isFile:()=>true,isSymbolicLink:()=>false})})` returned `C:\\Untrusted\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`. The environment-provided root was therefore **not** reliably pinned to the conventional OS directory. A symlinked/junction parent could also evade a leaf-only `lstat` check. This is a reproducible source-level weakness, **not** a demonstrated exploit on the user's Windows machine.

## Fix

- Require `SystemRoot` to match **exactly** a drive-root Windows directory `^[A-Za-z]:\\\\Windows\\\\?$` (case-insensitive), supporting a non-C system drive and optional final backslash. Reject nested lookalikes, relative/UNC/device paths, traversal, alternate streams, separators and whitespace tricks **before any filesystem read**.
- Use `lstatSync` to verify the actual `Windows`, `System32`, `WindowsPowerShell`, and `v1.0` directory components are directories and not symlinks/reparse-point aliases reported as symlinks. Also require the final `powershell.exe` to be a regular non-symlink file. Every failure throws a generic non-secret exception.
- Keep the B1-08 native runner's absolute-path invocation and reduced environment unchanged; it already catches resolver errors and fails the independent PG orphan proof closed without deleting owned fixtures. **No process is started by the resolver.**
- Caveat: no native Windows reparse-point behavior or Authenticode signature was verified; this is a path/metadata hardening, not a complete executable trust attestation.

## Actual isolated local verification

Runtime: local Linux Node **v22.16.0**; no user's Windows/Mac connection. Scratch `/mnt/data/bostan-b109-isolated`, 30GiB available filesystem, ~4.8GiB available RAM before work; only tiny source files and one bounded zero-exit Node child. No PostgreSQL, browser, install, model or cloud process was started.

| Artifact | Git blob SHA (matches actual executed local bytes) |
|---|---|
| `scripts/bostan-private-windows-powershell-binary.mjs` | `2bbd611ac3a9f6035a4a72adc1793675dd96b106` |
| `scripts/bostan-private-windows-powershell-binary.test.mjs` | `ce265ae89e8d723004f43e303122ee389db14613` |

`node --check` on module **PASS**. Final `node --test scripts/bostan-private-windows-powershell-binary.test.mjs` **7/7 PASS**, 0 failed, 0 skipped, including: direct-root drive variants, exact five-component inspection, nested fake root refusal before filesystem access, malformed/UNC/relative/ADS refusal, missing/linked/non-directory ancestor denial, missing/linked/non-file leaf denial, sanitized errors, and a **real zero-exit Node child** that does not bypass absent native Windows executable validation.

An initial local test iteration failed **1/7** due to a test helper defaulting an explicitly `undefined` root to `C:\\Windows`; the test was corrected to call the resolver directly. Final source/test blob hashes were compared to GitHub update results and passed **7/7**. The native runner was not executed.

## Remaining release NO-GO

- Native Windows PowerShell process enumeration, real embedded PostgreSQL migration/cleanup and zero `io_worker` or unattributed processes, authenticated HTTP 16-stage real proof, Windows disk/memory admission and Chromium Playwright remain **UNRUN** on this head. Issues #234 and #237 stay OPEN.
- Last observed Windows C: ~0.323 GiB free, below >=2GiB system minimum; isolated workspace/TEMP each require >=6GiB; RAM actual unmeasured. Authorized Mac/Windows remote desktop quota was exhausted on Oct 28; do not reconnect/circumvent.
- With legitimate device access and safe resources, use only fresh marker-owned `Bostan-B109-qa`/`Bostan-B109-temp`, Node >=24.11 and frozen dependencies. Verify real system PowerShell path/metadata, 16-stage HTTP, no leftover owned/unattributed PostgreSQL workers, and cleanup of only test-owned fixtures.
- macOS retake, Chromium E2E on both platforms, reproducible compiled server, first zero-cost live agent, Windows/Mac installers, independent security/licensing, backup/recovery and complete release qualification remain open.

**PRIVATE Draft only; releaseQualified:false; release NO-GO.**
