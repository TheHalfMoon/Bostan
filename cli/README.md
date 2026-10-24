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

## Local PostgreSQL cold snapshots (source checkout only)

These commands are for private, stopped Bostan localhost applications. They
require a prepared source checkout and a working pg_ctl binary.

```bash
# Stop Bostan first (Ctrl+C); confirm PostgreSQL is stopped.
bostan app backup --local

# Verify the generated backup (read-only).
bostan app verify --local /absolute/path/to/backup-folder

# Restore only into a HOME path that does not already exist.
bostan app restore --local /absolute/path/to/backup-folder --into-new-home /absolute/path/to/new-home
```

The snapshot copies Bostan-managed local app state, private PostgreSQL data
and secrets under ~/.bostan/backups with per-file SHA-256 checks. It refuses
live or uncertain PostgreSQL, a held runtime lock, symlinks and unsafe files.
Restoration never overwrites an existing HOME. It also rewrites Bostan launcher-owned
absolute storage, logging, backup and secret-key paths to point into the new
HOME, while leaving arbitrary user-defined paths unchanged. Verify the
resulting app in a separate test HOME before relying on it for recovery.

**Privacy warning:** Cold backups contain credentials and potentially
sensitive company content. Files are private on disk but are NOT encrypted;
manifest digests detect accidental corruption, not malicious replacement of
the whole manifest. Keep them offline and private. No cross-OS or Postgres
major-version portability guarantee exists. Full-app restore/relaunch passed a focused macOS + PostgreSQL 17 disposable
smoke test, but broader disaster recovery is not qualified. Do not run backup concurrently with
other Bostan operations.
