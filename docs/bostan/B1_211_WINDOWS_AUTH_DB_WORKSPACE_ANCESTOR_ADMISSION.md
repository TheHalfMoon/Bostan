# B1-211 — Native Windows auth/DB QA workspace ancestor admission

Status: PRIVATE OPEN DRAFT ONLY. Release NO-GO. Direct stacked parent: B1-210 PR #467. No publication, Actions, main merge, paid service, foreign process termination or customer data.

## Source-backed defect

The existing auth/DB runner accepted a QA checkout by its resolved basename and existence of .git, and TEMP by a matching B### basename plus leaf-only lstat symlink refusal. An intermediate Windows junction/reparse directory, a redirected .git, or a TEMP path alias was not refused before executing the native auth/DB workload. This is a path admission gap, not evidence that a foreign process was executed.

## Repair

A read-only, fail-closed admission checks exact canonical drive-rooted Windows paths for checkout and TEMP, matching three-digit wave names, every drive/root/ancestor/leaf through lstat and realpath, and ordinary unlinked checkout-local .git directory. Reject UNC/device paths, drive-relative paths, traversal, ADS, controls, ambiguous trailing names, symlink/junction ancestors, redirected Git metadata and missing paths. Preserve legitimate separate workspace and TEMP volumes. The runner calls this gate before subprocess planning, disk checks or any child process. Refusals use a fixed diagnostic marker and do not expose inspected paths.

## Evidence

On isolated Linux Node 22.16.0, test-first import of the not-yet-implemented helper failed as expected (RED, exit 1). After repair, node --test on the new native-filesystem-injected module returned 8/8 PASS, zero skips, exit 0, and node --check passed for helper/test. Scenarios include separate-volume acceptance, checkout/TEMP ancestor links, realpath aliases, linked/missing/non-directory .git, UNC/device/traversal/ADS/noncanonical paths, wrong wave, wrong platform and filesystem errors. The runner's source integration and exact remote Git blob identities must be independently checked after commit. No actual Windows filesystem or PostgreSQL was used.

## Limits and outstanding release gates

Read-only preflight is not atomic against concurrent privileged swaps and does not prove OS ownership, permissions or installed dependencies. A checkout using a .git file/worktree is deliberately refused; a normal self-contained QA clone is required. Native Windows compatibility and actual PG18.1 forced-crash io_worker zero-orphan (#234), installed compiled authenticated localhost HTTP/Better Auth/Chromium (#237), full TS7/Vitest, macOS/Linux PG/bwrap, installed three-OS E2E, privacy/tenant/security and donor LICENSE/NOTICE/provenance qualification remain open. Remote Desktop Commander exhausted monthly quota must not be retried/bypassed; retained B212 QA assets remain untouched.
