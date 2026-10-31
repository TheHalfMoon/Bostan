---
title: Bostan local development — unqualified preview
summary: Source-level development expectations, not installation instructions
---

**Bostan is not release-qualified.** Its private source workspace has not passed full dependency, installed-runtime, network, secrets or cross-platform validation. It must not be used with production databases or customer data.

## Intended local workflow

The monorepo contains a Node.js API, React interface and PostgreSQL-backed state. Source-level work requires an authorized private checkout, the repository-pinned package manager, Node.js 24.11 or newer, and a disposable directory containing synthetic test records.

Before executing project scripts, audit dependency installation effects, telemetry, provider defaults, startup processes and the configured local port. The existing development command names are not evidence that a complete Bostan runtime was qualified. Never use donor registry commands to substitute for an unpublished Bostan installer.

## Networking boundary

Loopback development and binding to LAN/Tailscale are different security postures. Do not expose Bostan to another device, open a firewall port or switch authentication modes until tenant, session, host-binding and agent-effect controls pass independently on that platform.

For current design concepts see [deployment modes](/deploy/deployment-modes), [database](/deploy/database) and [source-development preview](/start/quickstart). This page intentionally does not instruct installation or service startup.
