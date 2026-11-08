# B1-216 — Windows Auth/DB child invocation boundary

**Private draft engineering only; RELEASE NO-GO.** Direct parent: private Draft PR #472, `2ffe436dce4c7ea7ef24c85942cb4802f3ac8893`. Do not merge, enable Actions, publish, deploy, contact providers, use customer data, or alter retained QA.

## Source-backed gap

The B1-214 captured-child helper used `spawnSync` with `shell:false`, but accepted a bare executable name, a relative working directory, and any supplied environment object. A caller accidentally passing `process.env` could reintroduce inherited credentials and Node preloads; a bare executable could be resolved through `PATH` despite `shell:false`. The existing production planner supplied absolute binaries and an allowlisted environment, so this is a **helper-level defense-in-depth gap**, not evidence that the existing runner executed a foreign binary or leaked credentials.

## Repair

Before calling `spawnSync`, refuse non-absolute executable or working-directory paths, NUL-containing arguments, unknown child environment keys, duplicate keys under Windows case folding, and non-string environment values. Permit only the explicit Bostan QA environment key set. If a Windows `SystemRoot` is supplied, require conventional `drive:\Windows`, a matching OS-only `PATH` to `System32`, and matching optional `WINDIR`, `SystemDrive`, `ComSpec`, and `PATHEXT`. A deliberately empty `PATH` without `SystemRoot` remains supported for isolated synthetic tests. Rejection returns only the existing fixed `{status:1}` result, never echoes input and never spawns. The bounded 1 MiB pipes, no stdin, no shell, timeout, redacted output, and final read-only orphan-gate orchestration are unchanged.

## Actual isolated test-first evidence

On Linux Node 22.16.0, the exact parent Git blob `99841f18d1932c17963b05e4b1a3c883f81641f0` was reproduced locally. The new seven-case boundary suite initially had **2 PASS / 5 expected RED** against the parent. After the repair, the seven new cases plus the **unaltered seven-case B1-214 captured-child suite** passed: **14/14 PASS**, zero skipped, exit 0. The legacy suite includes a real synthetic Node child that prints forged success and private sentinel text, and a real oversized-output failure. `node --check` passed for both test files and the helper. All local source files were compared against exact parent Git blob identities before edits; the final new Git blobs are recorded in the PR.

## Limitations and release gates

No native Windows process was run, no actual PostgreSQL 18.1 forced-crash io_worker/orphan acceptance #234, no installed compiled authenticated localhost HTTP/Chromium #237, and no full root/server TS7/Vitest or three-OS installed E2E. This helper does not provide atomic OS executable attestation or prevent privileged concurrent filesystem swaps. Preserve donor LICENSE/NOTICE/provenance. **RELEASE NO-GO.**
