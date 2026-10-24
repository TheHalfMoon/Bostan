# Bostan CLI

**Development preview only — not a complete Bostan installation or release.**

This CLI supports limited offline functionality:

```bash
bostan --help
bostan --version
bostan status
bostan install --local
```

`status` is read-only and reports whether a verified Bostan CLI preview is installed. `install --local` installs **only the Bostan preview CLI** from the current source/package: an isolated payload under `~/.bostan/cli` and a new command at `~/.local/bin/bostan`. It refuses existing commands, unexpected file types, symlinks and changed managed files. It never downloads binaries or accesses the former product's state. The caller must invoke it explicitly.

This does **not** install or start the Bostan server, database, AI agents or system services. Update, uninstall, onboard, run, remote installation and all release commands remain disabled pending safety qualification. Windows CLI installation is not qualified.

Project: https://github.com/TheHalfMoon/Bostan

License: MIT; see LICENSE and original attribution/provenance documentation in the repository.


## Local Bostan application (source checkout only)

The complete application has a separate foreground development launcher.
After installing workspace dependencies and building the UI, with system
PostgreSQL installed locally, run:

```bash
bostan app doctor
bostan app run --local --port 3100
```

The launcher creates isolated `~/.bostan/app` data and credentials, starts a
private PostgreSQL service and the existing Bostan application server,
checks `/api/health`, and stops both on Ctrl+C. No global Postgres service,
background daemon, cloud server, or automatic updater is created.

This is **source-only, development-qualified**, and must not be exposed on a
public network or used for high-value production data. The source server
is still undergoing migration of internal dependencies. The preview binary
from `install --local` deliberately cannot start the full application.
