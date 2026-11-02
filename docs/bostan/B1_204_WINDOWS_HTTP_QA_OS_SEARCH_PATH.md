# B1-204 — Private Windows HTTP QA OS executable search-path admission

**Private Draft / Release NO-GO / 2026-11-02 (Asia/Riyadh).**

## Source-backed issue

The Windows localhost HTTP QA runner creates an isolated synthetic child environment, but the former allowlist copied operator-controlled `PATH`, `ComSpec`, `PATHEXT`, `SystemDrive`, and `WINDIR` directly into that Node child. A malicious or stale operator executable search directory could therefore influence any subprocess the test server launches. This is a source-backed executable-resolution risk, **not** evidence that a foreign program ran on a user device.

## Fail-closed change

`buildPrivateWindowsHttpQaEnvironment` now requires a canonical direct `<drive>:\\Windows` `SystemRoot` (or `WINDIR` when SystemRoot is absent). It synthesizes `PATH` as only `<root>\\System32`, `ComSpec` as `<root>\\System32\\cmd.exe`, fixed `PATHEXT`, and the matching `SystemDrive`. Operator PATH, ComSpec, PATHEXT, WINDIR and SystemDrive are never forwarded. Missing, UNC, nested, traversal, slash-separated or malformed OS roots are refused before server startup. Existing isolated HOME/TEMP, database URL, loopback origin and application environment gates remain unchanged. No process termination, PostgreSQL lifecycle change, user file deletion or network access is introduced.

## Native isolated evidence

- Source before fix: exact private GitHub blob `e0538606cab005616c0af1fe548651bb71285faf`.
- Linux Node 22.16.0 test-first: three new synthetic environment tests **0 PASS / 3 expected RED** on original source; the operator PATH was demonstrably present in the returned child environment.
- Repaired source blob `dc810b6077383558e3a9a85445f89cb7102f5bec`.
- Existing environment test blob `0a5053a51a38c861f029209df3e2e6f415a11928` and database URL test blob `84c3ca93e63cc4027891244ef3eb60857e0697b7` updated only to supply the required explicit synthetic OS root.
- New regression blob `ccd90c5912ce55b02d2b0cd39157dce232f5262a`.
- **15/15 PASS, zero skipped, exit 0** using `node --test *.test.mjs` against the four exact GitHub-hash-matched files; `node --check` of repaired source passed. These were isolated pure Node tests, not real Windows execution.

## Boundaries

This is a bounded conventional-path policy, **not** kernel attestation of Windows OS directories or a native Windows process-spawn proof. Native Windows PowerShell/CIM, actual PostgreSQL forced-crash #234, fully installed compiled authenticated HTTP and Chromium #237, full root TypeScript 7/Vitest and installed three-OS E2E remain unqualified. Device access is still subject to its monthly quota. Retained unverified `D:/Bostan-B212-qa` remains untouched. No main merge, Actions, release, public publication, deployment, paid services, customer records, foreign process cleanup or retained-file deletion.

**RELEASE NO-GO.**
