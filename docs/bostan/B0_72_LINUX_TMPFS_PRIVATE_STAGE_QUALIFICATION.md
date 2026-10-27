# B0-72 — Explicit Linux tmpfs qualification and portable PostgreSQL prerequisite evidence

**2026-10-27.** Stacked private Draft on B0-71 PR #220 (base `0eec757efe5804b4f2ebc2d2f7b6f6bf6eac3f16`). Keep TheHalfMoon/Bostan **PRIVATE**, GitHub Actions **OFF**; no merge to `main`, end-user release, registry publishing, public deployment, paid AI calls or real customer data.

## Linux/WSL2 qualification gap

Bostan's full compiled server+UI staging entrypoint already supports Linux, but requires at least **4 GiB free** both in the checkout and in the hardcoded verified system staging root `/tmp`. On the available Ubuntu 26.04 x86_64 WSL2 machine, `/tmp` is a safe isolated tmpfs with about **3.8 GiB available**, while the WSL VM has over **6 GiB MemAvailable**. The preexisting 4 GiB minimum therefore rejects all runs even when memory and disk resources can hold this disposable staging workload. Weakening global safeguards or redirecting stage deletion to arbitrary `TMPDIR`/HOME is unacceptable.

## Changes

- New read-only `scripts/bostan-private-linux-tmpfs-admission.mjs`. The default action is inert `--plan`. Explicit `--check` inspects the canonical real `/tmp`, Linux tmpfs filesystem magic `0x01021994`, >=**3.5 GiB** tmpfs free, and >=**5 GiB** available Linux memory, with fail-closed input and filesystem checks. It returns `releaseQualified:false`, `temporaryStageOnly:true`.
- Existing staged server shell supports a narrower **explicit QA-only opt-in**, `BOSTAN_LINUX_PRIVATE_TMPFS_QA=1`. Without it, both stage and source checkout still require the existing **4 GiB**. With it, only the Linux system `/tmp` threshold reduces to 3.5 GiB **after** the new read-only admission passes. Source checkout still requires >=4 GiB.
- **All normal optional dependencies remain enabled in the app acceptance script.** Platform-native TypeScript 7 and Vite/Rolldown bindings are designated optional by their distributors but are required for real Linux builds. An exploratory workaround disabling all optional dependencies failed the live Linux compiled-server build and was therefore **reverted**, never accepted as a passing qualification. The actual PostgreSQL migration, dependency closure, staged UI, legal asset check and two-session authentication remain mandatory.
- No global OS mount, user HOME path, PostgreSQL service, browser settings or production release script changed. No release or paid model calls are enabled.
- Added six pure admission/negative-assertion tests and structural checks ensuring default-inert operation, Linux-only tmpfs admission, minimum resource thresholds and preservation of the 4 GiB source gate.

## Actual Mac verification

On **macOS arm64 Node 26**, all **17/17 focused source/guard/bundled-font tests passed**, 0 failure/skip. The original Mac stage did not activate the Linux-only optional mode and retained standard disk checks.

Executed the real full compiled Bostan application on macOS:

```sh
bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated-authz
```

Result **EXIT 0** (~110 seconds). Frozen/offline package installation, server build, Vite production UI, private deployment, verified relocation, source/staged vendor font license notices, real PostgreSQL and HTTP passed. Actual authenticated **two independent synthetic sessions** performed 40 API requests; ownership and membership isolation, revoked access, invite acceptance, unauthorized promotions, viewer write restrictions and operator upgrade passed. No external model calls. Final markers `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, `CLEANUP_COMPLETED exit=0`.

## Actual Linux prerequisite evidence (not confused with full-app pass)

The **Ubuntu 26.04 WSL2 x86_64** device has Node **24.19.0** staged from the official Linux distribution and `pnpm 9.12.0` invoked through Linux Node, not Windows node. It has no permanently installed PostgreSQL and no noninteractive sudo, so a **disposable PostgreSQL 18.6** server and client were assembled by unpacking official Ubuntu `postgresql-18`, `postgresql-client-18` and `libpq5` packages into an owned directory on `D:`. A real Linux `initdb` created a temporary `/tmp` cluster, `pg_ctl` started it, `createdb` created `bostan_qualification`, and `psql` queried version **18.6** successfully. The PostgreSQL process and cluster were stopped/removed, **EXIT 0**, no global package installation. This validates the database binary, not the Bostan server.

The read-only new Linux `--check` ran **on the actual WSL2 machine**, returning `qualified:true`, `releaseQualified:false`, `freeKiB=3994952`, `availableMemoryKiB=6739772`, `stageFreeMinimumKiB=3670016` (3.5 GiB) and `standardSourceFreeMinimumKiB=4194304` (4 GiB).

The initial Linux pnpm install with all optionals enabled failed at `opencode-linux-x64-baseline-musl@1.18.34` with a missing file inside the disposable pnpm store (not a PostgreSQL failure). The exploratory second install with `--no-optional` **completed** (`B072_LINUX_REQUIRED_DEPENDENCIES_PASSED`), but the actual Linux compiled-server acceptance then **FAILED** at `@bostan/shared` TypeScript compilation: `Unable to resolve @typescript/typescript-linux-x64`. The native TypeScript binary is an optional distribution dependency yet required for any TS7 Linux build. This proves `--no-optional` is **not** a valid workaround and cannot be used to claim Linux qualification. The code no longer enables it. The full original-optional install must be repaired or otherwise qualified before claiming Linux compiled app readiness.

Linux native admission unit/structural checks themselves passed **8/8** on Ubuntu with real Linux Node 24.19.0; no server HTTP success was claimed. The failed compiled attempt ended with exit 1 before starting Bostan HTTP.

## Open gate

Until an actual **Linux compiled Bostan server and relocated private HTTP/PostgreSQL acceptance** reaches the shell's `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS` with cleanup exit 0, Linux end-to-end qualification is **NOT PROVEN**. The full Linux production browser experience, Windows full app, real governed free-model agent completions and comprehensive source/native dependency license review remain separate open release gates. Bostan is **NO-GO** for release. No unsupported inference from Mac or PostgreSQL-only checks.
