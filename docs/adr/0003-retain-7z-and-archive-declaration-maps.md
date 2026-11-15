# 0003. Retain 7z and archive optional declaration maps

Status: accepted for qualification (2026-11-15); native performance unproven

## Context

Candidatec933bd77, run43621574796, passed16 jobs including macOS installed
onboarding/restart/uninstall. Windows again exceeded300 seconds. Its verified
full-payload archive-only extraction took156454ms. The existing NSIS path first
extracts into temporary storage, then copies the complete tree into installation.
The observed installed executable and incomplete phase receipts show progress;
they do not prove a completed installation.

The previous76080-entry Windows payload contains5599 declaration maps and9338
JavaScript maps. Removing optional filesystem entries may reduce work during
both extraction and copy. No performance improvement is claimed until measured.

## Decision

Keep the supported7z extractor and existing copy behavior. Relocate only valid
v3 declaration maps (`.d.ts.map`, `.d.mts.map`, `.d.cts.map`) with adjacent type
declarations into a single USTAR archive inside the owned production stage.
Preserve each original relative path, byte length and SHA-256 in a manifest.
Verify every archived byte and loose file identity before removing loose copies.
The normal packaged-runtime integrity check covers both new files. Use copied
dependency imports so archival never relies on shared store-file ownership.

Executable code, JavaScript maps, types, source, native tools, data and notices
retain their locations. Ambiguous, linked, non-ASCII, oversized, invalid or
USTAR-unrepresentable maps stay loose. Fixed archive permissions and zero
ownership/timestamps avoid embedding host metadata. This is not a general tar
extractor or a hostile concurrent-writer containment mechanism.

## Rejected alternatives

- Whole-runtime ASAR remains rejected by ADR0002's actual subprocess evidence.
- ZIP's direct-extraction path failed actual pinned codec fixtures: ordinary ZIP
  passed; a7za-verified forced-ZIP64 archive was rejected; a deep-path fixture
  crashed the extractor. The complete payload exceeds classic ZIP's65535-entry
  limit. The earlier fixture missing its destination directory was corrected
  before these conclusions. No Bostan application was installed by these small
  codec stubs.
- Moving the extracted directory can retain temporary-directory permissions and
  discard a chosen destination's ACL/inheritance. CurrentUser mode alone does
  not establish permission equivalence. Keep the existing copy behavior.

## Consequences and recovery

Declaration navigation maps are no longer adjacent until manually restored;
runtime JavaScript stack maps remain adjacent. This is a change to developer
navigation availability, not an identical filesystem layout. From the runtime
directory, inspect `bostan-declaration-maps.json`, then extract the trusted shipped
archive with `tar -xf bostan-declaration-maps.tar`. Entries contain only their
original regular-file relative paths. Existing declarations remain in place.

Local tests verify byte-for-byte extraction using the platform tar utility,
corruption/truncation/extra-entry detection and preservation of unselected files.
An actual tiny offline pnpm deployment verified that the main package's map is
independently owned and archived. Its workspace dependency remained multiply
linked despite the import-copy setting, so that map stayed loose and the source
copy remained intact. The initial assumption that all deployed workspace maps
would have one link failed; the observed behavior is preserved by the link guard.
Actual full-runtime archival counts must be measured in native CI.
Full native installation and diagnostics must qualify the candidate under the
unchanged300-second bound. Existing failures remain blockers. Third-party license
review, update/rollback and complete product acceptance remain separate open
requirements; retaining debug bytes does not itself establish license compliance.
