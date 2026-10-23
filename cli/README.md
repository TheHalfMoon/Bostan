# Bostan CLI

**Development preview — not ready for installation or release.**

Bostan is an autonomous-company and AI-agent orchestration platform. The preview CLI is intentionally limited to offline, read-only identity commands:

```bash
bostan --help
bostan --version
```

All operational commands (including `install`, `update`, `uninstall`, `service`, `run` and `onboard`) are currently refused. This prevents incomplete Bostan migrations from touching legacy service/data stores or downloading a different product's binaries. Do not attempt to bypass these restrictions by invoking internal development entrypoints.

The code foundation remains under qualification. Do not distribute, deploy, or run against real accounts, live payment systems, or company data.

Project: https://github.com/TheHalfMoon/Bostan

License: MIT. See the bundled LICENSE and the repository's source/provenance documentation for retained third-party notices.
