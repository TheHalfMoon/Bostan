# B0-17 — Fail-closed private NTFS DACL for disposable Windows source runtime

**Status: native Windows NTFS ACL behavior qualified on synthetic TEMP directories. Production Windows app security is NOT qualified. Release NO-GO.**

Base: private Draft PR #44, commit `80aad46acd7c0ee6f36cdeb9be588e48990a7e0f`.
Branch: `work/b0-windows-private-acl`.
Authorized Windows host: Abdulaziz, under this user's TEMP only.

## Problem and evidence

Node's `fs.stat().mode` does not represent NTFS effective access rules: files created with `mode: 0600` may report 0666 on Windows. B0-15 therefore left Windows secrets exposed to inherited or explicitly broad TEMP ACLs until an OS-native check was implemented.

Direct native testing discovered that `icacls /inheritance:r /grant:r` does **not** remove every explicit broad access control entry already on a TEMP folder. This was reproducible on a disposable test directory: extra sandbox principal ACEs survived the command. Reusing the original POSIX mode check or treating `/inheritance:r` as a complete privacy fix would be incorrect.

## Implemented

- Only when source runtime is explicitly authorized to use a normalized, existing Windows HOME **within TEMP**, the initial launch creates `HOME/.bostan` and immediately replaces its DACL before writing runtime locks, JWT/DB passwords, PostgreSQL cluster, or private logs.
- Uses the native Windows .NET `DirectorySecurity` API via noninteractive local PowerShell, replacing the **Access DACL section only** with a protected, inheritable three-principal full-control list: current Windows user SID, local SYSTEM (`S-1-5-18`) and BUILTIN Administrators (`S-1-5-32-544`). Ownership, SACL and system-wide settings are not changed. Does not call a shell or invoke untrusted scripts.
- Immediately verifies that inheritance is disabled and exactly those three allowed full-control entries exist; aborts otherwise.
- On subsequent launches of an existing Bostan QA profile, it **verifies without silently rewriting** permissions. If another account gained a broad ACE since last run, source runtime refuses to proceed.
- Rejects paths outside user TEMP, symlinks, invalid directory types, and non-Windows calls.
- Protects new descendants by inheritance from the hardened `.bostan` directory. This is verified on a synthetic nested `app/secrets/disposable-secret`, not merely the root ACL.
- Does not touch actual user HOME, modify global security policy, elevate privileges, install services, or alter other projects.

## Actual test status

- Windows `node --test scripts/bostan-windows-acl.test.mjs scripts/bostan-local-runtime.test.mjs scripts/bostan-runtime-recovery.test.mjs`: **22 passed, 0 failed, 6 explicitly skipped POSIX-only fixtures**.
- Native Windows filesystem test: private DACL created, verified on restart, inherited private DACL on nested secret; adding `Authenticated Users` with `icacls` caused the next verification to **fail closed** until the synthetic directory was deliberately reset.
- **Launcher integration test on Windows:** a disposable fake-source app with Bostan package identities and fake PostgreSQL binaries, and a pre-existing **overly permissive** `.bostan` root, was passed through the actual `runLocalRuntime` function. The launcher **refused before it created either the private secrets directory or any PostgreSQL data**. After deliberately securing only the synthetic root, the runtime progressed past the ACL guard, generated its test secrets in the protected tree, then stopped cleanly at the intentionally invalid fake PostgreSQL binary; its managed run lock was removed. This is not a real server startup or database integration test. It specifically proves ordering of the Windows security gate.
- macOS same three modules: **24 passed, 0 failed, 4 Windows-only tests skipped**. The existing 90-probe macOS cold-start limit and POSIX 0600 permission check are unchanged.

## Remaining limits

This is still a developer-only **TEMP HOME** experiment. It does not guarantee that all nested paths or subprocesses protect every newly produced secret, handle hostile same-user processes, lock down Windows job objects, enforce AppContainer sandboxing, survive concurrent DACL replacement races, or provide a signed standalone consumer installer. The caller can always read its own files. The Windows release gate, default model/provider execution qualification, full egress review and installer packaging remain open.

**Do not enable a permanent Windows install or run against personal/company data on this basis. Private Draft only. No deployment, public release, main merge or GitHub Actions enablement.**
