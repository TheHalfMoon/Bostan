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
