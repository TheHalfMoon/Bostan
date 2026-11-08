# B0-15 — Windows private PostgreSQL and source-runtime qualification

**Status: PostgreSQL and Bostan cold snapshot PASS on Windows; complete Bostan source server start FAIL. Release NO-GO.**

Parent: private Draft PR #42, commit `423a1de5eaa9cd20c07489920282f95b3ade6c35`.
Branch: `work/b0-windows-disposable-runtime`.
All operations were on the authorized Windows machine Abdulaziz with only disposable directories under the current user's TEMP.

## Exact provenance, compatibility and safety

- Host: Microsoft Windows 10.0.26300, x64; Node 24.19.0; Git 2.56; pnpm 9.12.
- PostgreSQL 17.11-4 Windows x64 **binaries archive** came from EDB's domain `get.enterprisedb.com`, not an executable installer.
- SHA-256 **verified before extraction**:
  `b9424ee7bc60b52450ff910a3630225df32e633f3cb29c1d126d9299d59aea28`.
  This checksum is documented by the vendor in EnterpriseDB/edb-installers issue #706.
- The ZIP (~362 MB) and unneeded bundled pgAdmin, documentation and build headers were deleted from the isolated working directory after extraction to conserve disk. The native PostgreSQL 17.11 `bin`, `lib` and `share` directories remained only in temporary QA paths.
- No Windows Service registration, machine-level database installation, firewall change, user HOME upgrade, credentials from the actual profile, cloud deployment, or release operation was performed.

## Windows PostgreSQL direct E2E — PASS

1. `initdb.exe` initialized a **new** PostgreSQL 17 cluster under the disposable temp location with randomly generated SCRAM-SHA-256 password.
2. `pg_ctl.exe` started on loopback `127.0.0.1` and a temporary port.
3. `createdb.exe` and `psql.exe` created a `bostan` database, synthetic table and row; query returned `windows-private-pg17`.
4. `pg_ctl.exe` cleanly stopped the database. No `postmaster.pid` remained.
5. `databaseStatus()` from Bostan's real recovery implementation reported **stopped**, **running** after restart, and **stopped** again. All were checked with the real Windows `pg_ctl.exe`, not mock shell scripts.

## Windows cold backup / restore — PASS

- Created a synthetic Bostan-managed app state using the **stopped real PostgreSQL cluster**.
- `bostan app backup --local` wrote a cold snapshot with **1,306 entries**.
- `bostan app verify --local` passed.
- `bostan app restore --local <snapshot> --into-new-home <new-temp-home>` passed.
- Known launcher-managed config paths were rebased into the new HOME.
- Started the **restored PostgreSQL instance** from its restored data directory, queried the original synthetic row `windows-private-pg17`, then stopped the database cleanly without a leftover PID file.

## Windows Bostan source app build — PASS; server launch — FAIL

- Private full source checkout, ~11,874 tracked files, completed.
- `pnpm install --frozen-lockfile --ignore-scripts --prefer-offline` passed (workspace bin-shim warnings for unbuilt packages were visible).
- `pnpm --filter @paperclipai/plugin-sdk ensure-build-deps` passed.
- `pnpm --filter @paperclipai/ui build` passed (non-fatal chunk/CSS warnings).
- With a freshly created disposable TEMP HOME, portable PostgreSQL bin on PATH, and explicit `BOSTAN_WINDOWS_TEMP_QA=1`, `bostan app doctor` reported prerequisites satisfied.
- **First full app run failed:** Node 24 requires the absolute TypeScript `--import` loader to be a file URL, not a Windows `C:` path. The private QA branch now passes `pathToFileURL(loader).href`. Unix behavior remained qualified in focused unit tests.
- **Second full app run remained NO-GO:** PostgreSQL started and was stopped cleanly on failure, but the Bostan server did not return HTTP 200 for `/api/health` within the runtime's startup window. This is a real **unresolved blocker**. There is no qualified Windows Bostan full application or installer.
- Both failed starts left **no managed app run.lock** and **no PostgreSQL postmaster.pid**, protecting the disposable test cluster from a false healthy state.

## Focused automated tests

- Windows: **15 passed, 0 failed, 6 explicitly skipped** in `node --test scripts/bostan-local-runtime.test.mjs scripts/bostan-runtime-recovery.test.mjs`. Skips represent POSIX shell-script mocks, POSIX mode-bit semantics or symlink-creation privileges unavailable on this Windows host, not feature pass claims.
- macOS: **21/21 passed** for the same two test modules.
- Native Windows PostgreSQL status checks, cold backup, verified restore and restored DB query were run **with real Postgres 17.11** to cover the database functions inadequately represented by POSIX-only mocks.

## Exact guardrails and remaining gates

- The Windows code path **requires** `BOSTAN_WINDOWS_TEMP_QA=1` and an existing normalized, non-symlinked HOME *inside the current user's temp folder*. The actual Windows user HOME is explicitly rejected; no general Windows support is enabled.
- Windows Node `fs.stat().mode` is not an NTFS ACL security measure. Mode-bit checks alone cannot qualify secret-file privacy. **Production ACL checks, Windows DPAPI/secret management, process isolation and Windows E2E remain open.** Do not use this experimental mode with personal/customer content.
- Bundled Windows/macOS native desktop application, standalone PostgreSQL deployment, native app signing, actual Windows AI agent tests and privacy/egress audit remain open.

**All changes remain in a private stacked Draft PR. GitHub Actions disabled, main unchanged, no public deployment or release.**
