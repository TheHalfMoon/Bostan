---
title: Bostan control-plane CLI — preview reference
summary: Planned operations are not an approved globally installed CLI
---

**Bostan is not release-qualified.** CLI command invocation, packaging and identity have not completed source-native and installed-platform qualification. Do not run donor `paperclipai` examples or assume the unpublished Bostan CLI is available from a package registry.

## Intended command groups

| Area | Intended behavior | Qualification concern |
|---|---|---|
| Companies | Inspect and manage company records | Strong tenant separation |
| Issues and projects | List and update assigned work | Per-role authorization |
| Agents | Manage agent configurations and heartbeat history | Explicit execution consent |
| Approvals | Review and decide governed actions | Immutable audit provenance |
| Skills and adapters | Inspect available runtimes and plugins | Trusted-source and sandbox boundaries |
| Costs and budgets | Report usage and enforce limits | No unexpected provider charges |

The actual set of checked-in flags, command names and exit codes must be verified against Bostan CLI source before any executable examples are published. Mutating commands need disposable synthetic data, ownership checks and rollback tests. External providers and paid operations are disabled for this qualification effort.

See [Bostan CLI preview](/cli/overview), [setup concepts](/cli/setup-commands) and [API overview](/api/overview).
