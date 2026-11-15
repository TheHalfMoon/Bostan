# ADR 0004: Direct Windows installation with a job-contained 7-Zip process

- **Status:** Proposed pending native Windows installer qualification and third-party license review
- **Date:** 2026-11-15

## Context

The pinned NSIS template extracts the embedded 7z archive to a temporary tree and then copies the full tree into the install directory. The Windows installed-app check repeatedly reached its unchanged 300-second bound. A failure-only measurement completed archive extraction in about 145 seconds, leaving the second filesystem pass as the main remaining cost.

The declaration-map archive reduced failure-only extraction by about 12 seconds but the full install still exceeded 300 seconds. A direct 7-Zip subprocess avoids the second copy pass, but a local NSIS fixture showed that terminating the installer alone leaves an ordinary subprocess running.

## Decision

For the Windows NSIS qualification candidate, invoke the checksum-pinned standalone 7-Zip CLI directly into the install directory. A small .NET Framework launcher creates the extractor suspended, assigns it to a Windows Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, then resumes it. Terminating the launcher closes the job and terminates the extractor.

After 7-Zip reports success, the launcher verifies every installed `resources/runtime` file against the build's SHA-256 manifest and compares the complete file/link inventory. A corrupt archive, missing file, changed file, unexpected file, or failed process exits nonzero before registration and launch. The installer keeps its existing retry/cancel behavior and the Windows functional gate keeps its 300-second bound.

The NSIS include override is limited to the pinned extraction macro and guarded by the exact app-builder template hash. It passes the current NSIS PID to the launcher. The launcher waits on both NSIS and 7-Zip; if NSIS exits first, it terminates the Job Object and awaits the extractor before returning. A fixed phase receipt confirms the direct extractor ran during the native installed-app qualification.

## Consequences and qualification boundaries

- The installer embeds 7za.exe, its `LICENSE.txt`, `COPYING`, and the generated runtime manifest. Inventory notice paths refer to the corresponding `$PLUGINSDIR` archive members. The binary hash and source template hash are checked during packaging.
- The license inventory continues to report that third-party license review is incomplete. This proposal does not authorize signing, notarization, release, or publication.
- Existing NSIS behavior uninstalls an older installation before extracting the new payload. The direct path does not add rollback of a partially extracted new version.
- The local fixture passes success, spaced and deep paths, corrupt archive rejection, manifest mismatch rejection, forced launcher termination, and forced NSIS termination without a surviving writer.
- Native Windows installer performance and full installed-app behavior remain unqualified until the exact candidate passes the existing 300-second Windows CI gate.
