# B1-89 — Fail closed on packed-import diagnostic deadline/child-exit race

Date: 2026-10-31. **STRICTLY PRIVATE · ZERO COST · NONPUBLISHING · STACKED DRAFT ONLY.**
Parent: B1-88 Draft PR #343, exact head `6ed0586713d62a7bfe94be93f5a8d668000bfd32`.
Scope: private synthetic Windows import diagnosis only; no production runtime, database, customer data or publishing changes.

## Reproduced defect

The opt-in 36-second no-PostgreSQL packed-import probe previously admitted every
`bounded_36s` outcome, even if the child had already exited with code 1.
A child that failed just as the timer fired, before its `close` event was handled,
could therefore be reported as a successful *diagnostic* despite an actual
missing-package/import error. This is **not** a product startup success,
but it undermines the trustworthiness of the probe used to investigate B1-60.

On the unchanged B1-88 source, an actual Mac Node 26 reproduction asserted
`admitPrivateWindowsProbeChildExit({outcome:"bounded_36s",exitCode:1})===false`.
It failed with `RED: deadline admitted child exit 1`, exit 1.
No Windows application, PostgreSQL or browser was started.

## Bounded repair

- Snapshot child `exitCode` and `signalCode` **before** intentional teardown
  can send its own signal. This preserves the distinction between a child
  failure observed at the deadline and an expected cleanup signal.
- A bounded diagnostic is admissible only if the child was still unexited
  and unsignaled at observation. A normal `child_exited` observation requires
  exit 0 and no signal.
- Check the final post-teardown numeric exit code as well. A nonzero code
  arising between deadline observation and cleanup completion cannot be
  concealed by the `bounded_36s` label. A null exit code from intentional
  signal-based cleanup remains valid for a **diagnostic observation only**.
- Keep the 36-second hard limit, SHA256 packed-runtime admission, private
  synthetic entry guard, localhost blocked PostgreSQL stub, bounded capture,
  profile requirements, cleanup checks and `releaseQualified:false` unchanged.

## Objective evidence

- Native authorized Mac Node 26, isolated exact B1-89 branch, no dependency
  install: **15 PASS / 0 FAIL / 0 SKIP** across the import outcome, deadline
  and capture suites.
- `node --check scripts/bostan-private-windows-packed-import-probe.mjs`: PASS.
- `node scripts/bostan-private-windows-packed-import-probe.mjs --plan`:
  `run:false`, `realDatabase:false`, `deadlineSeconds:36`,
  `releaseQualified:false`.
- `git diff --check HEAD~3 HEAD` on an isolated depth-4 exact-head clone:
  PASS, parent verified as B1-88 `6ed0586713d62a7bfe94be93f5a8d668000bfd32`.
- Only self-created ephemeral Mac test checkouts were removed by their own
  guarded traps; the preexisting B135 workspace and its untracked
  `.qa-playwright-browsers/` were not modified.
- The connected Windows device ID differs from the explicitly authorized
  original Windows device ID. **No native Windows execution**, real packed
  import, PostgreSQL stop, Chromium, heavy build or 180-second E2E was attempted.

## Limitations and release gate

This closes one **synthetic diagnostic false-GREEN race**, not the underlying
Windows packed static-import hang. It does not reproduce or fix the B1-60
shared-PostgreSQL concurrent-write RED, qualify the 18-stage Windows Better
Auth/HTTP/Chromium flow, or close #234 real multi-suite no-orphan proof.
The first genuine offline agent, Linux/macOS/Windows installers, full security
and privacy qualification, copy-first license/NOTICE and provenance remain open.

**Release NO-GO.** Repo PRIVATE; `main` unchanged and currently
`protected:false`; GitHub Actions disabled. Do not merge to main, enable
Actions, publish/deploy/release, npm pack, use paid models/cloud, delete retained
QA fixtures, stop foreign processes or perform unrelated disk cleanup.
