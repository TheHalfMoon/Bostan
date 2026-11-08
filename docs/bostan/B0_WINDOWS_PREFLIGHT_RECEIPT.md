# B0-14 — Windows source runtime prerequisite diagnosis

**Status: limited Windows preflight checks passed. Windows app/runtime remains unsupported and unqualified. Release NO-GO.**

Parent: B0-13 Draft PR #41 (commit `e7965f587d805317a433ff7264625859984188ba`).

## Machine and evidence (October 24, 2026)

Verified on the authorized Windows `Abdulaziz` computer:

- Node 24.19.0 and Git 2.56 present; pnpm 9.12.0.
- No `initdb`, `pg_ctl`, `psql`, or `createdb` on PATH, and no PostgreSQL directory at the ordinary system installation paths checked.
- Roughly 9 GB free on C: at inspection time (may change).
- A GitHub-authenticated **sparse, shallow** checkout of the *private* Bostan branch was used; no full dependency install, package download, services, or application launch.
- `bostan app doctor` identified missing server source/built UI/TypeScript loader in the sparse checkout, and the intentional `macOS/Linux platform` gate and absent PostgreSQL commands.
- Node syntax checks for source runtime and CLI passed.
- **6/6 Windows Node unit tests PASS** after changes. Includes rejecting inherited privacy/telemetry credentials, no writes for missing prerequisites, platform gate, native `.exe` tool lookup, and rejection of `.cmd` shims.

## Narrow code changes

- Local PostgreSQL binary discovery now probes `pg_ctl.exe` etc on Windows, including quoted absolute PATH entries, without choosing untrusted `.cmd`/`.bat` wrappers.
- macOS/Linux behavior is preserved for Homebrew symlinks and extensionless executables.
- Existing isolation assertion now compares a native `path.join(...)` result rather than a hard-coded POSIX directory string.
- Added a Windows-specific test proving that discovering fake `.exe` files **does not** accidentally authorize the unqualified source runtime.

## Required qualification before Windows support is enabled

The source runtime still explicitly limits the server path to macOS/Linux. Do NOT remove this gate until a disposable Windows PostgreSQL 17 installation and the full Bostan app can pass: bootstrap and migration, localhost-only binding, credentials and ACL, clean stop, abrupt crash, lock recovery, exact backup restore, real agent task, and uninstall/cleanup. Portability of PostgreSQL data directories between operating systems is **not** guaranteed.

A consumer installer remains out of scope for this preflight and has NOT been created. Never install software into the actual user's Windows profile or download a large server payload to a low-space C: without evaluating it first.

**Private Draft only; no merge to main, no release or publishing. GitHub Actions remain disabled.**
