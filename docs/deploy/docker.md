---
title: Docker — unqualified preview
summary: No approved Bostan Docker image or Compose deployment
---

**Bostan is not release-qualified.** No Docker image, published Compose quickstart or container-based deployment has passed Bostan security and cross-platform qualification.

## What is still being assessed

The imported repository contains Docker and Compose infrastructure, but it must be audited for image provenance, runtime identity, host/network exposure, embedded PostgreSQL persistence, secret handling, sandbox isolation, resource limits and clean shutdown before use.

Some source files may still contain legacy compatibility environment variable names or data-directory paths. These require compatibility testing; a legacy variable name is not proof that an upstream image or product should be installed.

## Restricted scope

Do not substitute a donor container image for Bostan, expose service ports, mount real credentials, run provider-backed agents, or follow unverified container commands. In particular, never place API keys in example shell histories or use customer databases for early QA.

A future reviewed container procedure must demonstrate isolated synthetic-data tests and governed agent effects on supported operating systems. Review [development status](/start/quickstart) and [deployment modes](/deploy/overview) before planning any deployment. **This page intentionally supplies no executable Docker instructions.**
