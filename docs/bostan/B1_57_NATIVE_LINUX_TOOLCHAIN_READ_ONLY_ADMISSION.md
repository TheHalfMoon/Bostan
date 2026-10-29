# B1-57 — Native Linux package/DB readiness: read-only early admission

Date: 2026-10-29. STRICT PRIVATE, ZERO COST, NONPUBLISHING; exact parent B1-56 Draft #310 at `c01d87e57704d1add68c4f70905e53162347289d`. No main merge or package/release.

## Why this prerequisite exists

Earlier Linux Node guard tests were correctly green but **did not** prove a real Linux Bostan runtime or installed distribution. The new native Ubuntu WSL2 probe confirms why actual Linux stage/runtime QA is blocked on the authorized system: Node.js **22.22.1**, while the pinned project's Linux TypeScript/Rolldown build closure requires Node **24+**; `pnpm` resolves into a **Windows-mounted** executable under `/mnt/c`, rather than native Linux; and all four native database tools **`initdb`, `pg_ctl`, `createdb`, `psql` are missing**. Docker Desktop's WSL integration is not enabled for this distro; no local PostgreSQL image was claimed available. macOS/Windows green E2E does not substitute for this real Linux gap.

## Engineering

Added `scripts/bostan-private-linux-native-runtime-preflight.mjs`, whose default and `--plan` are **inert**. An explicit `--check` performs read-only local inspection of operating system, x64/glibc, Node>=24, all 10 native CLI requirements, required Linux `/tmp` tmpfs, 3.5GiB free temporary stage, 5GiB available RAM and 4GiB free source checkout. The command scans only PATH and canonical executable identities, **rejects WSL Windows mounts (/mnt) and Windows `.exe/.cmd/.bat/.ps1` shims**, and emits fixed bounded machine-readable *missing requirement codes*, not full executable paths, user IDs, credentials, raw environment or customer data. It installs nothing, spawns no external processes, downloads nothing, does not build, and never creates any stage or database.

Wired this preflight **before the first mutable `pnpm`/PostgreSQL/staged deploy operation** inside the existing `scripts/bostan-private-linux-native-prebuilt-stage-authz.sh` full Linux Bostan authenticated (or browser/admin-race) acceptance. Existing source/compile/native-binary/font/owned-stage/real-PostgreSQL/cleanup/authorization rules and opt-ins remain unchanged; the preflight is one more fail-closed prerequisite, not a release qualification.

## Actual run receipts

- **Native macOS Node:** Existing Linux source/build/tmpfs/CLI regression tests + new preflight tests: **20/20 PASS**, zero skips. On Mac `--plan` is inert; no attempt to run Linux PostgreSQL from macOS.
- **Native Windows Node 24:** New focused preflight tests **5/5 PASS**, zero skips. `--plan` reported no mutations; 0 PostgreSQL processes, B144 tracked source clean.
- **Actual native Ubuntu WSL2 x64 Linux 6.18, Node22:** `/usr/bin/node scripts/bostan-private-linux-native-runtime-preflight.mjs --check` **EXIT 2 (correct fail-closed)**. The exact returned fixed missing requirements were `node_below_24`, `missing_native_pnpm`, `missing_native_initdb`, `missing_native_pg_ctl`, `missing_native_createdb`, `missing_native_psql`. Linux /tmp tmpfs and memory/disk admission were not the failed dimensions; the observed /tmp tmpfs had ~3.9GiB free, Linux MemAvailable ~7GiB, source drive >4GiB.
- **Actual Linux mutable-entry negative test:** `BOSTAN_LINUX_PRIVATE_TMPFS_QA=1 bash scripts/bostan-private-linux-native-prebuilt-stage-authz.sh --run-authz` **EXIT 2**, with exactly the same prerequisite list, **before any package staging, DB startup or installer**. The before/after count of candidate `/tmp/bostan-staged-server-????????` stage dirs was **unchanged**. No distro packages or Docker settings were changed.
- **Native Ubuntu Node22:** all 4 relevant Linux source/runtime/toolchain/read-only test suites **20/20 PASS**, zero skips. This is unit/negative admission evidence, **not a native Linux app/runtime/browser/PostgreSQL end-to-end PASS**.

## Next blockers (no implicit host modification)

A genuinely isolated native Linux Node 24+ toolchain, native `pnpm` and pinned Linux optional TypeScript/Rolldown bindings, plus native disposable PostgreSQL CLIs/binaries are prerequisites for the existing deeper full real Linux staged server + Better Auth + Chromium journey. Provision only with suitable explicit isolation, disk/resource admission and verified package sources. Do not bypass by launching mounted Windows binaries or treating a Docker integration hint as a working Linux PostgreSQL install.

**Release: NO-GO**. Full Linux app/installers, untrusted model sandbox, load/transaction correctness, release security/privacy/NOTICE/license/provenance/branding audits remain open. Strictly PRIVATE DRAFT, no main merge, GitHub Actions activation, distribution, deployment, paid models or real customer data.
