# 0002. Keep the provider runtime outside ASAR

Status: accepted (2026-11-14)

## Context

Windows native installation still exceeds its120second bound with the complete
runtime, even after changing the archive to solid7z. The payload has tens of
thousands of files. Packaging that runtime as one ASAR could reduce installer
filesystem work, but Bostan launches agent CLI subprocesses using Electron's
embedded Node with ELECTRON_RUN_AS_NODE.

An owned, three-file prototype used the actual pinned Electron45.2.3/Node24.22.2
and @electron/asar packer. Embedded Node failed MODULE_NOT_FOUND when asked to
execute the packed entry point. The probe stopped before testing native binary
execution, so no native-unpack compatibility is claimed. Receipt retained in
the owned runtime-asar-cxRcan fixture; no product or installer was changed.

## Decision

Reject putting the complete server/provider runtime inside runtime.asar under
the current subprocess contract. Keep it outside the desktop shell's existing
ASAR. Any future packed-runtime design must first demonstrate actual provider
entry points, embedded Node children, native tools, filesystem behavior and
recovery; successful main-process imports alone are insufficient.

## Consequences

- Existing provider subprocess paths and the complete runtime remain available.
- Windows installation performance remains unresolved. No deadline increase,
  removed runtime files or successful-install claim follows from this experiment.
- A later format/loader change requires new evidence and may supersede this ADR.
