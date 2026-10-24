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

## Recover a stopped local runtime after a crash

The local PostgreSQL database may outlive its UI/server process. **Do not delete**
`~/.bostan/app/run.lock` by hand. From the prepared **source checkout** use:

```bash
bostan app recover --local
```

Bostan clears the Bostan-owned runtime lock **only** if the prior owner PID
is gone and its local PostgreSQL cluster is confirmed stopped. It refuses to
remove the lock while PostgreSQL runs, if its status cannot be checked, or
when the lock or managed paths look unsafe. Database files are preserved.
This is manual recovery, not an automatic data repair, restore or migration.

Never point the recovery command at another user's HOME. The separately
installed CLI-only preview cannot invoke app commands.
