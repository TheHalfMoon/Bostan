# B0-49 — Real native Windows private CLI safety regressions

**2026-10-27.** Private stacked Draft above B0-48 (#197, commit `72245d6`). Keep Bostan **PRIVATE**, GitHub Actions **DISABLED**, `main` unchanged, and Release **NO-GO**. No public publishing, deployment, paid models or customer-data mutation.

## Native Windows issue reproduced

On authorized Windows device `Abdulaziz`, the CLI preview itself ran `--help` and `--version`, but the existing three CLI safety suites initially failed. `cli/src/__tests__/bostan-preview.test.mjs` used `new URL(...).pathname` as an operating-system path for `spawnSync`. On Windows this yields `/D:/...` instead of a valid `D:\...` drive-qualified path. The same portable-file-URL mistake affected the synthetic `company inspect` CLI integration test. These tests therefore failed before verifying the actual security behavior.

A separate ZIP-archive test unconditionally constructed a file symlink. This particular Windows account cannot create symlinks (`EPERM`, Developer Mode/symlink privilege unavailable), causing a harness failure even though the ZIP inspector correctly blocks unsafe paths when a symlink is present.

## Change

- Convert CLI test paths to native OS file paths using `fileURLToPath(...)` rather than `.pathname`. No product CLI executable logic, user-installation code, or security protocol was relaxed.
- Split the local ZIP inspector test into its cross-platform read-only/no-remote assertions and a separate explicit symlink-negative test. That symlink-only case is **skipped** (not represented as passing evidence) when native Windows denies creation with `EPERM`/`EACCES`; on hosts where symlink creation works, the ZIP inspector must still reject it.
- Add an explicit Windows-only safety assertion: `bostan install --local` is intentionally refused with exit status **2** and never creates files inside a fresh, disposable `HOME`. This is a *negative safety contract*, not permission to install a consumer Windows app.

## Executed verification, no extra dependencies or paid services

Sparse-cloned only `cli`, `scripts`, `ui/src/lib`, `docs/bostan` and root manifests into a disposable `D:\Bostan-b049` checkout; checkout files were approx. 13 MiB with no package installation and no PostgreSQL. Ran `node cli/src/bostan-preview.mjs --help` and `--version`, followed by the actual:

```powershell
node --test cli\src\__tests__\bostan-preview.test.mjs cli\src\__tests__\bostan-local-install.test.mjs cli\src\__tests__\bostan-company-export-inspect.test.mjs
```

**Native Windows: 13 PASS, 0 FAIL, 13 SKIP** (12 intentionally unqualified native installation/shell scenarios + 1 symlink-negative fixture that Windows denies creating). The tests cover isolated status/no HOME writes, reject donor install/update/service operations and registry release, verify local ZIP parsing and deny remote ZIPs, and verify that Windows native CLI install remains **blocked** without managed state writes. No runtime model or paid provider; only disposable test fixtures under Windows TEMP.

## Remaining gates

Windows **installed application** remains unqualified: native desktop packaging, PostgreSQL/runner and installer ACL lifecycle need a separate governed full E2E. The Windows machine currently shows approximately **4.3 GiB free RAM and 8.8 GiB free D storage**, and has no `initdb`/`pg_ctl` in PATH, below the existing Windows installed-qualification requirements. There is no claim of Windows native installer success. Full Linux UI + Rust integration, real free-model agent cases, missing peer-dependency qualification, independent security review and release sign-off remain open.
