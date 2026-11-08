---
title: Bostan private-network access — qualification pending
summary: Network-access planning reference, not a Tailscale deployment recipe
---

**Bostan is not release-qualified.** No shared LAN/Tailscale instance is approved for team use. A VPN or tailnet is not a replacement for authenticated authorization, consent or application security.

## Intended architecture

A future private-network mode could require application-level login, explicit hostname restrictions, TLS or a justified private transport, auditable device access and company-level isolation. Verify that unauthenticated local-trusted mode cannot be exposed via a bind preset.

## Required tests before any network-access instructions

Demonstrate real installed-runtime host binding on every supported OS, strict authentication for non-loopback requests, scoped invitations, safe session expiry, CSRF/origin handling and rejection of cross-tenant operations. Exercise agent execution and secrets effects with synthetic data, including restart and forced-crash recovery.

Do not follow inherited donor bind presets, copy credentials into a VPN-connected host, or reuse upstream service configuration as a Bostan release. See [deployment overview](/deploy/overview) and [security-conscious development guidance](/start/quickstart).
