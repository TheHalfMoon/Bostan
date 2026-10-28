# B0-76 — Real private native Linux first-admin eight-caller HTTP race qualification

**Date:** 2026-10-28. **Release status:** NO-GO. This is test-only evidence in the private `TheHalfMoon/Bostan` project, stacked Draft on B0-75 PR #224 (`acd66fd9a4a500962afbb1cfdb45cac4479dbba5`). GitHub Actions stay OFF, no merge to main, no releases, no paid models or customer data.

## What changed

Extended the existing Linux ext4 prebuilt production-stage acceptance script with a second **explicit** mode `--run-admin-race`, alongside unchanged `--run-authz`. It runs the same complete fail-closed Linux QA gates: source/build identity, installed Linux x64 glibc native TypeScript 7.0.2 and Rolldown 1.2.5, pinned Copilot vendor assets, canonical `/tmp` tmpfs with resource minimums, source and staged font/licenses, frozen offline production `pnpm deploy`, all internal-only stage links, real PostgreSQL migrations, private localhost compiled HTTP and isolated owned cleanup. The new mode invokes the **existing** synthetic eight-caller `--run-deployed-admin-race` end-to-end fixture. There is no change to production admin-claim behavior.

The CLI remains inert without an explicit mode, rejects unknown/publish flags, cannot run on non-Linux, and refuses Linux without `BOSTAN_LINUX_PRIVATE_TMPFS_QA=1`. Tests cover the additional mode and safety controls. Focused **17/17** Mac source/negative tests (including standalone race fixture) passed, 0 fail/skip. Shell syntax and whitespace checks passed.

## Real Ubuntu 26.04 x64 WSL2 ext4 test

Using the **prebuilt private native Linux ext4 source** and Linux Node 24.19.0 with an isolated QA pnpm store prewarmed from the free npm registry, executed the explicit `--run-admin-race` mode. Vite compiled production UI, copied it into the built server, deployed the compiled app **offline into Linux `/tmp`**, audited **375 SQL migration files**, **1,902 internal symlinks**, **zero foreign symlinks**, **72 production dependencies** and staged pinned font/legal assets. The real PostgreSQL server migrated; real authenticated localhost `/api/health` returned **200**, `bootstrap_pending` before claim.

The concurrent synthetic race returned:
- **8** independent authenticated user sessions and **8** concurrent first-admin claims.
- **Exactly 1** successful claim; **7** concurrent claims rejected.
- Real committed PostgreSQL `instance_admin` roles **exactly 1**.
- **8/8** replayed claims rejected; unauthenticated claim rejected.
- **0** model/provider calls. No real email addresses or customer data were used or printed.

Actual terminal markers: `BOSTAN_PORTABLE_STAGED_FIRST_ADMIN_RACE_QUALIFIED`, `BOSTAN_LINUX_NATIVE_STAGED_POSTGRES_FIRST_ADMIN_RACE_PASS`, `BOSTAN_LINUX_NATIVE_QA_CLEANUP exit=0`, `B076_REAL_LINUX_NATIVE_TMPFS_ADMIN_RACE_ACCEPTANCE_PASS`, **`B076_LINUX_RACE_EXIT=0`**. The real end-to-end native Linux run took ~351 seconds including private UI compilation, offline deploy, DB and HTTP.

**Limitations:** Both the Linux two-session authorization test (B0-75) and concurrent eight-user first-admin race (B0-76) are qualified on a **private disposable native Linux x64 glibc source/stage** only. They do not qualify user-facing Linux desktop installer/browser GUI, true Windows native app, real free-model agent task completion, full dependency license audit, security threat-model, or a public release. DrvFS/P9-mounted runtime remains an unsuitable qualification medium. Keep Bostan private, Actions OFF, Draft/unmerged.
