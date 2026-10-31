---
title: Bostan development quickstart
summary: Local source preview only — no public installation or release
---

Bostan is **under active development and not release-qualified**. The repository is private. There is **no approved public Bostan installer or hosted service**; do not use unrelated registry packages or upstream product installation commands as substitutes.

## Local source development (not production)

Prerequisites are a private, authorized checkout, Node.js **24.11 or newer**, the repository's pinned pnpm toolchain, and a disposable environment with synthetic data and non-production credentials.

From the authorized repository root:

```sh
pnpm install
pnpm dev
```

These are **source-development commands**, not a verified Bostan installation or release procedure. The full imported workspace and dependency/telemetry defaults have **not yet passed Bostan qualification**. Review scripts, network effects and external providers before running them. Installing dependencies can access package registries; do not run this setup in an offline-only environment or with real customer data.

The local server/UI and embedded PostgreSQL startup are not yet qualified on every supported OS. A failed startup is a qualification failure, not an instruction to disable safeguards or install a different product.

## CLI preview

The repository contains a private `bostan` CLI preview, but packaging, commands and installed-runtime behavior are still being qualified. **Do not publish packages or recommend `npx bostan`**. Use only the verified local-source CLI test workflow in an owned disposable checkout.

## Current release gate

The following must pass before an installation guide is published: full source-native Linux sandbox Vitest, TypeScript and unprivileged bubblewrap tests; installed Windows/macOS/Linux journeys; governed agent side effects and consent; repeated embedded PostgreSQL stress; privacy/security; and third-party license provenance.

You can review the [core concepts](/start/core-concepts) and [architecture](/start/architecture) without installing anything. This documentation is a development preview, **not a deployment recommendation**.
