# B1-198 — Windows localhost HTTP QA scratch-home identity

**Status:** PRIVATE DRAFT / UNMERGED / RELEASE NO-GO. Stacked directly on B1-197 PR #454 at exact head `f22f5ea3fda6131f4d29b5a2e2bfaef0d78d8a6b`. No main merge, Actions, publication, deployment, paid provider, customer data or foreign process operation.

## Actual defect

The native Windows localhost HTTP QA runner created a unique `bostan-private-auth-http-*` home with `mkdtempSync`, then deleted its pathname recursively after server, database and process-tree checks. Its final authorization inspected only the current directory type and a reproducible `BOSTAN_QA_OWNED` marker's bytes. A different ordinary directory could replace the original at the same pathname and contain the same marker. The previous guard would then delete that different directory and its contents.

**Independent baseline reproduction:** an exclusive Linux Node 22 filesystem fixture reproduced the exact old marker/type guard and `rmSync(home,{recursive:true,force:true})` pattern. After renaming the original directory and creating a replacement ordinary directory with the same marker and a `KEEP.txt` file, the old guard returned success and actually deleted the replacement KEEP file. No user checkout or remote device was involved.

## Repair

- New `scripts/bostan-private-windows-owned-home-reclaimer.mjs` captures the original ordinary temp root, exact child home and ordinary single-link marker identities (device, inode, birth time), canonical ancestry and fixed marker bytes immediately after creation.
- Reclamation checks the same identities and physical ancestry again, refuses a replacement directory, changed/missing/linked marker, hardlink or changed temp root, and never emits a local pathname. It deletes only after all preexisting server-closed, PostgreSQL-cleaned and multi-snapshot zero-orphan gates have passed.
- The actual `scripts/bostan-private-windows-live-http.mjs` runner invokes that captured one-shot reclaimer instead of raw pathname-based `rmSync`. A refusal is a failure, retains the directory for owner inspection and cannot yield a passing receipt. The marker itself is not a transferable cleanup authority.
- No PostgreSQL lifecycle, PID termination, authentication or HTTP test logic is weakened.

## Scoped qualification

- Linux Node 22 isolated **8/8 PASS, zero skips, exit 0** for ordinary owned cleanup, same-path replacement with preserved KEEP, linked/junction replacement, identical-byte marker replacement, marker hardlink, missing marker, foreign home and mutated marker bytes.
- Native test suite uses a Windows `junction` for its linked-replacement case rather than requiring developer-mode directory symlink privileges. **Native Windows execution is NOT claimed.**
- `node --check` passed for both new standalone JavaScript files. Exact GitHub helper and test blobs matched local `git hash-object` results. The real runner source was fetched again from GitHub and inspected for the new capture and cleanup calls and absence of its former direct `rmSync(home,...)`.
- No full root TypeScript 7/Vitest, installed Windows runtime, native PostgreSQL, forced-crash or Chromium test was run.

## Limitations / release gates

Identity rechecking immediately before recursive deletion is **not atomic** against a privileged concurrent directory swap during `rmSync`, and does not attest all nested files against hostile writers. The test home must remain exclusive and owner-controlled. A refusal leaves evidence in place; it is not permission to manually delete retained QA. The earlier `D:/Bostan-B212-qa` asset copy remains **RETAINED / UNVERIFIED** and was not touched. Remote Desktop Commander monthly quota remains a device-access blocker; do not bypass it.

Issue #234 genuine repeated native Windows PostgreSQL forced-crash zero-orphan evidence, issue #237 fully installed exact-SHA compiled authenticated HTTP/Better Auth/Chromium, root/server TS7/Vitest, native Linux bwrap, Mac/Linux real PG cache, three-OS installers, consent/privacy/tenant/security and donor LICENSE/NOTICE provenance remain **NO-GO**.
