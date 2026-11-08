# B1-84 — Fail closed on postmaster.pid pathname replacement before Windows shutdown

**Status:** Private, zero-cost, nonpublishing, test-only hardening. Release **NO-GO**.

## Exact parent and defect

Parent B1-83 Draft PR #338, commit `9a04a75d55ad476d5e14557af9ba5ea929837b4a`. The Windows teardown validated `postmaster.pid` through a bounded open file descriptor and two `fstatSync` calls. A concurrent rename and same-content replacement of the marker path could leave that descriptor's identity unchanged while the pathname now identified a different file. The old code then called the injected `pg_ctl` runner despite losing the original marker identity.

## Objective reproduction and narrow correction

On authorized Mac Node 26 / Vitest 5, a synthetic regression replaces `postmaster.pid` immediately after the second `fstatSync`, while the original descriptor is still open. Before the correction, **42 passed, 1 failed, 1 skipped**: the function resolved `stopped` and the injected runner was reached. No actual PostgreSQL or user process was stopped.

The correction performs a fresh `lstatSync` of the original marker path after descriptor validation and compares ordinary-file type, device, inode, birth time, size and modification time to the opened file. Any missing, symlinked or replaced path fails closed with the existing constant privacy-safe error before the runner or CIM inspection. The synthetic regression now passes.

After correction: **43 passed, 0 failed, 1 skipped**; targeted strict `tsc --noEmit -p packages/db/tsconfig.json` **EXIT 0**; `git diff --check` **PASS**. Test skipped on Windows because the injection relies on POSIX rename semantics for an open file; this is not native Windows proof.

## Scope and remaining gates

This is a bounded pathname identity preflight, **not** a claim that the subsequent native `pg_ctl` invocation is atomic with the check, nor proof of ownership of the PID or all child processes. No native Windows test was run: connected Windows Desktop Commander device ID differs from the previously explicitly authorized `6641fb27-1a94-40b7-a76d-06e5e61a49af`. Mac had 39 GiB free disk and 57% system-wide free memory at admission. Existing QA worktrees, retained scratch fixtures and user processes were left unchanged.

Required release gates remain: true native Windows multi-suite PostgreSQL no-orphan proof #234, packed Windows runtime startup and real 18-stage Better Auth/HTTP #237, Chromium/UI, offline agent, installers, Linux/macOS/Windows privacy/security and license/NOTICE verification. No Actions enablement, main merge, publishing, deployment, release, npm pack, paid compute/model/cloud, customer data, foreign process termination, or unrelated disk cleanup.
