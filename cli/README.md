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


## Free-provider first-agent development smoke (not offline)

A focused macOS source-runtime test verified that OpenCode could prepare a
legacy `opencode_local` agent with `opencode/beam-free` and no stored API key.
Bostan source runtime starts OpenCode in standalone mode to avoid colliding
with an unrelated existing OpenCode background server. This is **only**
a local CLI-process isolation guarantee; the model still uses an external
online provider. Nothing is uploaded to a public project or deployment.

A synthetic `beam-free` agent completed its task but later exceeded
its heartbeat deadline; in contrast, `deepseek-v4.1-flash-free` agents
completed two separate synthetic tasks and finished both heartbeat runs
cleanly. Never treat issue `done` alone as proof of a successful run.
See `docs/bostan/B0_FIRST_AGENT_RUNTIME_RECEIPT.md` for the precise
results, limitations and open release gate. No paid model/provider should
be selected by an automated test or release process.


A repeatable first-agent smoke test lives at
`scripts/bostan-first-agent-free-e2e.mjs`. It never runs by default; a
developer must explicitly select a Bostan localhost server running with
an isolated temporary HOME and opt in to free **online** model use:

```bash
BOSTAN_E2E_URL=http://127.0.0.1:41517/ \
BOSTAN_E2E_DISPOSABLE_HOME=/tmp/<your-disposable-Bostan-home> \
BOSTAN_E2E_CONFIRM_TEMP_DATA=1 \
BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL=1 \
node scripts/bostan-first-agent-free-e2e.mjs
```

It requires the managed config and active run lock in the temp profile,
checks that the source runtime is private and healthy, and creates only
synthetic organizations/tasks. It fails if the heartbeat ends `timed_out`
or otherwise fails even if the task happens to be `done`. Never point
it at a real profile or rely on free-provider availability for CI.

### Optional OpenCode step budget (legacy adapter)

When creating an `opencode_local` agent with `runner: "legacy"`, you can
include `maxAgentSteps: 12` in its `adapterConfig` to cap OpenCode's
primary build agent to at most 12 agentic iterations. The valid integer
range is 1–128. This is optional: it does not alter any other agent or
promise a token/cost ceiling. A pre-existing tighter OpenCode step limit
stays in effect. The feature deliberately refuses remote execution where
its generated local configuration would not enforce the limit.

The disposable opt-in end-to-end runner uses that limit for its online
free-model tests. Its default is `opencode/deepseek-v4.1-flash-free`; set
`BOSTAN_E2E_FREE_MODEL=opencode/beam-free` to exercise the second allowed
model. Paid and unknown model names are rejected by the harness.
See `docs/bostan/B0_AGENT_STEP_BUDGET_RECEIPT.md`.

## Windows TEMP-only ACL hardening (B0-17)

A Windows source runtime remains **developer QA only**: it requires an
explicit `BOSTAN_WINDOWS_TEMP_QA=1` opt-in, an existing isolated HOME under
the current user's TEMP directory, working native PostgreSQL, Node, and a
prepared source checkout. It is not a supported consumer installation.

Before writing credentials, the first launch creates `HOME/.bostan` with an
NTFS **protected access DACL** for only the current account, SYSTEM and
Administrators. Restart verifies the existing DACL and fails if permissions
have become broader. An unsafe or non-temporary HOME is refused. Do not
use `icacls /inheritance:r` as a substitute for this check: it can leave
broad explicit ACEs intact. See
`docs/bostan/B0_WINDOWS_PRIVATE_ACL_RECEIPT.md`.

The app's general Windows packaging, normal graphical stop controls,
native default agent E2E, full data privacy and security review, and signed
installers are not yet release-qualified.


## Windows developer-only orderly local stop (B0-18)

From a full Bostan source checkout, `bostan app stop --local` now requests
shutdown of the same private Windows TEMP QA runtime as
`bostan app run --local`. Both command windows must use the identical
explicit temporary `HOME`, set `BOSTAN_WINDOWS_TEMP_QA=1`, and have native
PostgreSQL tools on PATH. The existing NTFS access DACL is verified before
the source CLI reads the private local stop token. This uses an authenticated
loopback request and parent-to-child Node IPC instead of an arbitrary
process kill. The stop command checks that PostgreSQL has stopped before
reporting success.

This is **not a supported Windows installer or service feature**. The
installed CLI-only preview continues to refuse this source command.
Full native Windows Bostan-server-plus-PostgreSQL shutdown and active agent
draining are still open qualification gates. See
`docs/bostan/B0_WINDOWS_ORDERLY_STOP_RECEIPT.md`.
