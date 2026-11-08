# B1-210 — Preserve final read-only PostgreSQL orphan scan on auth/DB QA failure

Private draft only. Direct parent: B1-209 PR #466, exact head c021f48662539051e527d90fa6ddba3fd400308b. Release NO-GO.

## Source-backed defect

The native Windows auth/DB runner called process.exit(1) inside its per-command failure branch. A failed, timed-out, signaled, or throwing shared build, auth test, or real PostgreSQL migration therefore skipped the final read-only PostgreSQL orphan scan. This is especially relevant after a failed embedded PostgreSQL test: a nonzero test result does not establish that its PostgreSQL process tree is gone.

## Repair

A synchronous fail-closed orchestrator preserves the existing seven pinned commands, the initial no-orphan gate, and existing pass receipts. After any attempted workload fails, it skips all remaining workloads but **always attempts the final read-only orphan gate**. An initial gate failure starts no workload. A final gate failure, or any earlier failure, forces nonzero runner exit; no failure can yield the overall success receipt. Exceptions are reduced to fixed bounded diagnostics, not raw child error messages. The helper never kills, reclaims, or modifies processes.

## Isolated evidence

Test-first: new node:test module initially failed to import because the orchestrator did not exist. Linux Node 22.16.0 after implementation: 10/10 tests PASS, zero skipped, exit 0; node --check helper/tests PASS. Scenarios cover full success, shared build failure, real DB test failure, thrown spawn, signal, spawn error, failed initial gate, failed final gate, malformed command plan, final gate exception and null spawn result. Exact runner source was patched from parent blob 0b03091c84f89f463ef7d0ea37905b822d0d2660.

## Boundaries

No native Windows, real PG18.1, forced-crash io_worker, compiled authenticated HTTP, Chromium, full root/server TS7/Vitest, macOS/Linux live PostgreSQL or installed 3-OS acceptance was run. The final gate is a read-only observation, not a cleanup guarantee, and cannot guarantee no race or privileged process substitution. Retain all unverified B212 assets; do not bypass exhausted Remote Desktop Commander monthly quota. Donor LICENSE/NOTICE and provenance remain untouched. #234 and #237 remain release blockers.
