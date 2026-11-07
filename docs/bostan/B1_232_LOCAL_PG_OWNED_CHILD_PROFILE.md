# B1-232 — Isolate local PostgreSQL QA home, tool configuration and startup order

Date: 2026-11-07 (Asia/Riyadh). **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO.**

## Problem

B1-231 excluded unrelated API tokens and loader hooks from the local PostgreSQL QA *child environment*, but retained inherited `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `COREPACK_HOME`, `PNPM_HOME` and user temp locations. Even with no inherited token environment variables, PostgreSQL/libpq and package managers can load a user's personal `~/.pgpass`, `~/.npmrc`, pnpm/Corepack state and other home files. The local migration qualification claimed not to read personal credentials, which cannot be justified while using the ambient home. It also probed `initdb/pg_ctl/psql` executable versions **before** the existing Cloud-admission check or creation of any owned scratch profile.

## Implemented

New test-only `scripts/bostan-local-postgres-owned-profile.mjs` creates a uniquely owned `qa-home` **inside** the fresh per-run `mkdtempSync` PostgreSQL scratch, but only after its original scratch+marker identity is captured and verified. The helper creates each child directory without recursive reuse, requests restrictive `0700` permissions where supported, records exact `dev`/`ino`/`birthtimeMs` identities for each directory, and checks they remain ordinary unlinked owned directories. It refuses a planted, missing, changed, linked or ambiguous profile; it never attempts to reclaim foreign directories.

The resulting environment overrides operator-profile paths (`HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_*`, `COREPACK_HOME`, `PNPM_HOME`, `NPM_CONFIG_USERCONFIG`, `NPM_CONFIG_CACHE`, `TMP`, `TEMP`, `TMPDIR`) to point **only** under that new `qa-home`, with Windows `HOMEDRIVE`/`HOMEPATH` derived from the same temporary location. It additionally sets `COREPACK_ENABLE_NETWORK=0`, `NPM_CONFIG_OFFLINE=true` and `NPM_CONFIG_UPDATE_NOTIFIER=false` to prevent package manager auto-fetch during this offline QA workflow. These flags do not prevent arbitrary custom project scripts from networking; network egress confinement is a separate release gate. Existing synthetic localhost `PGHOSTADDR`/`DATABASE_URL` stay pinned.

The real `scripts/bostan-local-postgres-migration-qualification.mjs` now:

1. Performs read-only `validatePrivateLocalCloudIsolation(process.env)` **before** creating scratch or starting any child executable (rather than launching a separate Node child).
2. Captures the owned scratch/marker, creates the private profile within the previous socket/port `try/finally`, and uses only the profile-returned environment for PostgreSQL binary version probes and all later PostgreSQL subprocesses.
3. Routes **every** `initdb`, `pg_ctl`, `createdb`, `psql`, `pg_dump`, `pg_restore` call, plus all three `pnpm migrate` calls, through `qaExec`, which checks the same private profile's original identities **before** reaching the subprocess API.
4. On cleanup, adds a profile-identity gate to the existing original-scratch, cluster and PostgreSQL process stop gates. If home setup failed partially or a profile path was replaced, cleanup refuses recursive deletion and retains the scratch for safe investigation.

This is test-only, does not change the production server, database schema, or packaging.

## Executed evidence

- Real Linux Node **v22.16.0** on freshly created exclusive `/tmp/bostan-b232-fixture-*` directories: **11/11 PASS**, 0 failures/skips. Test file `scripts/bostan-local-postgres-owned-profile.test.mjs` Git blob `70e1bea369d537c32dc4c2f7c73bdf6eb34136f2`; helper Git blob `2d415b6183ea6777a50e7d870f614cfa0bfd9d2f`. Both were independently SHA-1 Git blob hash matched to the exact files saved in PRIVATE GitHub.
- Tests include a **real Node child subprocess** proving `HOME`, `USERPROFILE`, `PNPM_HOME` and `NPM_CONFIG_USERCONFIG` no longer refer to user profile paths; a planted `qa-home/KEEP.txt` left intact after refusal; replaced/linked home refusal; a replacement of the nested cache directory; original scratch proof mutation; error redaction; caller environment immutability, and package-manager offline flags.
- Exact modified runner Git blob `c528b85183afc84b43dab428e174dcf7a2fcebf4` was fetched independently after the write and checked on **eight explicit structural/sequence properties**: Cloud admission precedes scratch; original receipt precedes private profile; private profile precedes all CLI probes and initdb; no raw unguarded named PostgreSQL CLI calls; profile gate precedes stop/removal; all three migration calls inject `qaExec`; exact helper/test blob match.
- New source-level contract `scripts/bostan-local-postgres-owned-profile-integration.test.mjs`, Git blob `a150b6cae9cf5c6a5e5c6c82589f43b10cc7ce11`, is committed for complete checkout execution. It includes an isolated `vm` test of the exact `qaExec` function text to enforce no subprocess call after profile ownership fails. **It was not run as an entire Node test file in this isolated runtime** because the complete runner was not materialized. Do not count the eight structural checks as eight Node test results.
- The older B1-231 seven existing plus seven new privacy tests passed **14/14** in the preceding wave, but were **not rerun** as a full installed workspace in this wave.
- There is **no `initdb`, `pg_ctl`, `psql` or `pnpm` installed in this Linux test environment**. No genuine PostgreSQL or pnpm migration, native Windows process, Better Auth, Chromium or root TS7/Vitest ran here.

## Important limitations

The safety gate is a **temporal** inode/canonical-path check, not an atomic filesystem lease across `check → spawn` or `check → delete`. `PATH`, Windows `ComSpec`, other executable paths, and the contents of the source checkout remain separate executable-provenance concerns. A fresh `COREPACK_HOME` intentionally cannot reuse a user's cached manager: an installed/pinned offline pnpm must be qualified, and no automatic network fetch may be treated as acceptable. Native Windows `HOME`/profile behavior and macOS/Linux CLI compatibility require genuine device/installation tests.

The Remote Desktop Commander provider previously reported a monthly usage limit and expressly said not to retry/reconnect; no bypass or device call was made. Retained `D:\Bostan-B212-qa` PG assets remain unverified and untouched.

**RELEASE NO-GO**: #234 actual repeated native Windows PostgreSQL18.1 forced-crash `io_worker` zero orphans, #237 fresh SHA-owned fully installed compiled authenticated localhost HTTP/Better Auth first-admin/tenant/roles/Chromium, macOS/Linux real PostgreSQL, root TS7/Vitest, Linux sandbox, installed 3-platform app E2E, consent/privacy/security and LICENSE/NOTICE provenance still pending. No main merge, Actions, publishing, release, deployment, paid provider or foreign process/file changes.
