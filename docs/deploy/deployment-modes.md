---
title: Bostan deployment modes — engineering review
summary: Mode names are inherited configuration contracts, not approved deployment procedures
---

**Bostan is not release-qualified.** Mode descriptions below document the current code model and do not authorize production hosting.

| Source configuration mode | Intended trust boundary | Qualification required |
|---|---|---|
| `local_trusted` | Single owner on loopback only | Local-only binding and no unauthorized requests |
| `authenticated` + `private` | Authenticated private network | Host validation, identity, company isolation and secure consent |
| `authenticated` + `public` | Internet-exposed authenticated service | Independent external security and deployment qualification |

A mode flag alone does not establish secure authorization. Public-mode support must be treated as unavailable until real installed cross-platform tests, automated access-control checks, secrets redaction and agent tool-effect governance all pass.

Do not invoke inherited onboarding, hostname or external-cloud commands as Bostan setup instructions. The source may still contain old compatibility identifiers; changing them requires a tested migration path. Consult [deployment overview](/deploy/overview) and [local development preview](/deploy/local-development).
