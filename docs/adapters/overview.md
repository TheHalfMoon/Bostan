---
title: Bostan adapters — unqualified engineering overview
summary: Agent integrations require explicit permissions, isolation and execution evidence
---

**Bostan is not release-qualified.** This page describes intended adapter contracts, not approved installation or execution instructions.

## Design contract

Adapters connect the control plane to external or local agent runtimes. A typical adapter accepts a scoped task, reports progress and a structured result, records attributable resource use and submits tool effects to policy and consent gates.

The inherited source currently contains local CLI, process, HTTP/webhook, and external plugin integration paths. Their presence does **not** establish that all provider credentials, arbitrary shell commands, network effects or third-party plugins are safe to enable.

## Mandatory qualification

- Deny actions outside the agent's explicit workspace, network and company policy.
- Require auditable approval before side effects, and preserve correct cancellation/timeout semantics.
- Keep credentials out of transcripts, request forwarding, diagnostics and downloaded plugins.
- Prove installed Windows/macOS/Linux behavior and isolation with disposable synthetic fixtures.
- Require explicit, zero-cost provider selection; no automatic paid model calls.

**Do not install npm adapters or execute runtime/plugin API requests based on inherited donor examples.** Current Bostan adapter capability labels remain provisional until source-native tests pass. For conceptual information see [architecture](/start/architecture) and [development status](/start/quickstart).
