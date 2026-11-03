# B1-220 — Preserve disposable PostgreSQL scratch after uncertain startup

**PRIVATE DRAFT ONLY · RELEASE NO-GO.** Direct parent #476 exact HEAD `20dd33a7648874eb2983c8c1ad850cd830a005e7`.

## Source-backed issue

At #476, `scripts/bostan-local-postgres-migration-qualification.mjs` set `started=true` only after `pg_ctl ... -w start` returned successfully. If `pg_ctl` started PostgreSQL but then timed out or returned an ambiguous failure, `started` stayed false and the `finally` block recursively deleted the disposable cluster directory. This could remove files while a child PostgreSQL daemon remained alive. No actual orphan or deletion incident was observed.

The old cleanup also checked only marker existence, not its exact content, ordinary-file status, scratch directory identity, or realpath agreement.

## Repair

Mark `startAttempted` immediately before invoking `pg_ctl`. Preserve the scratch directory if startup is unconfirmed, if a confirmed start cannot be stopped successfully, if exact owned-marker/root identity cannot be proven, or if removal fails. Only a confirmed start permits an owned `pg_ctl -m immediate -w stop` call. No foreign process is terminated. A failed cleanup emits a fixed, reason-coded error rather than raw PostgreSQL output. For verified cleanup, require an ordinary unlinked scratch directory and marker, stable canonical realpaths, and the exact owned marker text before recursive removal. This remains a non-atomic filesystem preflight; it is not proof against privileged concurrent replacement.

## Test-first evidence

Isolated Linux Node 22.16.0: new test module initially RED because the helper import was missing (`ERR_MODULE_NOT_FOUND`), then **7/7 PASS**, zero skips, exit 0, with `node --check` passing for helper and test. Synthetic callbacks cover confirmed start/stop, ambiguous start, throwing or false stop, missing/invalid ownership, failed removal, and invalid state. Exact locally tested Git blobs: helper `6ef4e23ab447f0f62d344359236589e337bf5a6f`; test `37fef7369079e51f10de80cd89484095c1eee103`. The parent runner was source-inspected and updated; its full integration suite and real PostgreSQL were **not executed**.

## Limitations and release gate

This does not qualify PostgreSQL forced-crash `io_worker` zero-orphan #234, compiled installed authenticated Windows localhost/Chromium #237, Linux bwrap, real macOS/Linux PG cache, full TS7/Vitest, installed Windows/macOS/Linux E2E, or privacy/consent/security/legal provenance. Retained `D:/Bostan-B212-qa` remains untouched; Remote Desktop Commander monthly quota was not retried or bypassed. No main merge, Actions, release, publication, cloud/paid providers, customer data, or donor LICENSE/NOTICE edits. **RELEASE NO-GO.**
