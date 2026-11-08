---
title: Deployment overview — qualification pending
summary: Bostan deployment modes are under engineering review, not available as a public installation procedure
---

**Bostan is not release-qualified.** The repository is private. No production, internet-facing, hosted, or team deployment has been approved, and none of these modes should be enabled for real users or customer data.

## Imported deployment modes

The current source retains three architectural mode labels. They are **configuration concepts, not verified supported deployment instructions**.

| Mode | Intended boundary | Qualification state |
|------|-------------------|---------------------|
| `local_trusted` | Single-owner local, loopback-only | Not release-qualified |
| `authenticated` + `private` | Authenticated private-network access | Not release-qualified |
| `authenticated` + `public` | Authenticated internet-facing access | Not release-qualified |

Local development needs independent tests of binding, authorization and data isolation. Private-network operation also needs verified host allowlists and consent. Public access adds further security, TLS, identity, secrets and abuse-prevention gates.

## Current policy

Do not use donor installation commands, public-mode configuration shortcuts or upstream cloud deployment recipes to substitute for an approved Bostan release. See [the source-development preview](/start/quickstart) and [architecture](/start/architecture).

Until installed-runtime, tenant-security and network isolation qualifications pass, deployment guidance remains withheld. The descriptions above do not establish production readiness.
