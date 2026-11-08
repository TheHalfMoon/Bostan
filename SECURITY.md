# Bostan security policy

**Bostan is a private, unreleased development project.** No production
security guarantee or supported public deployment exists yet.

## Report a vulnerability privately

Authorized collaborators should use the [Bostan security advisory page](https://github.com/TheHalfMoon/Bostan/security/advisories/new)
when GitHub permits access, or contact the repository owner through an
existing private channel. **Do not disclose exploit details, credentials,
private logs, tokens, or customer content in a public issue or PR.**

Reports should include affected component and revision, impact, minimal
reproduction using synthetic data, and suggested mitigations. Do not test
against third-party systems without permission.

## Scope and temporary restrictions

Bostan development presently uses disposable, loopback-only source runtimes.
Native source validation is not consumer installer certification. Do not
expose a local developer instance to a public network, upload private QA
artifacts, or run untrusted agent actions without an appropriate sandbox.
No publishing, deployment, releases, or GitHub Actions activation is authorized.

See [development and migration gates](docs/bostan/FOUNDATION_AND_MIGRATION.md).
