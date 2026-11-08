# B1-215 — Windows Auth/DB Node executable ancestor admission

**Private Draft / release NO-GO.** Direct parent #471 at `02cd76b1804aac67ad7cf9240c80c680e1646c44`. No main merge, Actions, publication, deployment, paid services, customer data, foreign-process termination, or retained QA changes.

## Source-backed defect

The B1-209 execution planner checked `process.execPath` only at its final file: `lstat(nodeBinary).isFile()` and `!isSymbolicLink()`. A normal `node.exe` leaf behind a linked/junction ancestor, or a dot-segment alias, passed this admission and could redirect the child executable outside the path the operator believed was pinned. This is an admission weakness, not proof of malicious execution.

## Change

Before planning any of the seven child commands, require a canonical absolute Node path, read-only `lstat` and `realpath` agreement on every directory ancestor (including filesystem root), and an ordinary unlinked Node executable with matching real path. Reject with the existing fixed executable-admission error; do not kill, clean, or follow a redirected path for execution. Node may remain outside the QA checkout. Existing Windows OS executable checks and pinned subprocess environment remain unchanged.

## Test-first evidence and limits

On isolated Linux Node 22.16.0, the original exact GitHub source blob `e879b80f0497dc91374c99b7e7fa560618ac8f3e` accepted a linked Node ancestor and a dot-segment path: 2 expected RED cases (2 other positive controls PASS). The repaired source passed the full unmodified nine-case B1-209 execution suite plus two new cases: **11/11 PASS**, zero skipped, exit 0. A separate four-case synthetic suite passed **4/4** after repair. `node --check` passed. These tests use only exclusive disposable synthetic files; they do not run Windows, PostgreSQL, or Chromium.

This preflight is not atomic under privileged concurrent filesystem swaps; actual Windows Node 24 / filesystem junction behavior, native PG18.1 forced-crash orphan proof #234, authenticated compiled HTTP and Chromium #237, and installed three-OS E2E remain unqualified. No donor LICENSE/NOTICE/provenance changes. **RELEASE NO-GO.**
