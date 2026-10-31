---
title: Bostan CLI — private source preview
summary: CLI interface is being migrated and has no approved package installation
---

**Bostan is not release-qualified.** Its CLI is a private source-level engineering preview, not an approved globally installable command or registry package. There is no verified public installer, so do not run donor CLI commands or assume an unpublished Bostan command is available from a registry.

## Intended interface

The imported CLI architecture includes diagnostics, instance configuration, context profiles, and control-plane actions such as issue and agent operations. These categories describe code under review; they are not promises that every command currently works on all operating systems.

## Migration boundaries

Legacy data directories, environment variables and context-file identifiers may still exist for internal compatibility. Preserve them until migration tests prove that renaming will not destroy existing state or silently redirect secrets. Avoid using real credentials or persistent production instances during qualification.

The local-source workflow, when independently verified, should use an owner-controlled disposable checkout and synthetic data. For the current limitations, read [development quickstart](/start/quickstart), [setup command concepts](/cli/setup-commands), and [control-plane API](/api/overview). No executable CLI installation commands are endorsed here.
