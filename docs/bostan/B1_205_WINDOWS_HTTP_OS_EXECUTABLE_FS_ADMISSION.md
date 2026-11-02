# B1-205 — Windows HTTP QA OS executable filesystem admission

Status: **PRIVATE DRAFT / UNMERGED / RELEASE NO-GO**. Direct parent: B1-204 #461 at `9b827057d0f293784efa36075ce67c14c05a0721`.

## Actual gap

B1-204 stopped forwarding operator PATH/ComSpec/PATHEXT, but its canonical-looking `SystemRoot` string alone did not verify that the OS executable directories and `cmd.exe` were ordinary unlinked objects. A substituted/reparse-linked directory or absent executable could therefore pass the string-only admission. This is a source-level safety gap, **not** a demonstrated native Windows exploit.

## Repair

A read-only fail-closed native Windows preflight checks a direct drive-root `Windows` path, consistency of `SystemRoot` and `WINDIR`, and the `lstat` identity/type of drive root, Windows, System32 and cmd.exe. Missing, linked, non-directory/non-file, or conflicting inputs are rejected with a fixed diagnostic before TEMP scratch creation, PostgreSQL startup, or HTTP child spawn. The existing pinned child environment and resource/ownership guards remain in place. No process is killed or file deleted.

## Evidence and limitations

- Isolated Linux Node 22.16.0: **12/12** committed pure `node:test` cases PASS, zero skips, exit 0. Cases cover ordinary paths, case-insensitive matching, missing/conflicting roots, nested spoof, linked drive/Windows/System32/cmd, missing cmd, wrong object type and non-Windows refusal.
- JavaScript syntax checks on the new helper and test: PASS.
- The actual runner source was inspected after integration for the import, fail-closed call, and ordering before TEMP and database initialization.
- **Not run:** native Windows `lstat`/reparse cases, real PostgreSQL, compiled HTTP, Chromium, root TS7/Vitest, or three-OS installed acceptance. `lstat` then spawn is not atomic against privileged concurrent swaps, and this is not kernel attestation. Native Windows resource/tool quota remains unavailable; do not bypass it.
- Retained `D:/Bostan-B212-qa` remains unverified and untouched. Issues #234 and #237 remain OPEN. RELEASE NO-GO.

No GitHub Actions, release, publication, customer data, paid providers, donor-license removal, or foreign resource changes.
