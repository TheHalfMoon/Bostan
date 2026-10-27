# B0-48 — Portable Linux staging root and fail-closed dual-disk admission

**2026-10-27.** Private stacked Draft on B0-47 (#196, commit `d46841d37701f94dca7601b904a6c5a70e952e5b`). Do not publish/deploy, merge `main`, enable inherited GitHub Actions, use paid models, or mutate real user installations.

## Defect discovered during cross-platform review

The previously qualified **macOS** full-app staging script announced support for Linux but hard-coded `mktemp -d /private/tmp/...`; most Linux installations do not provide `/private/tmp`. Its cleanup case accepted either `/private/tmp` or `/tmp` without binding to the exact system temporary root of the invocation. It also checked free space **only for the source checkout**, though Linux `/tmp` may be on a smaller/different filesystem. The stage inspector trusted Node's environment-sensitive `os.tmpdir()` as an allowed mutation root, so caller-supplied `TMPDIR` could expand where a generated pnpm symlink was eligible for repair.

## Source fix

- `scripts/bostan-private-staged-server-check.mjs` now exports pure `portableStagingRoot(platform)` with explicit `darwin -> /private/tmp`, `linux -> /tmp`, and all unsupported platforms rejected. Its read-only CLI `--stage-root` resolves the selected standard system directory. It does **not** honor user-controlled `TMPDIR` for choosing an allowed mutation root.
- The one-link pnpm repair now authorizes owned disposable Bostan staging **only under that trusted resolved OS temp root**, rather than an arbitrary `TMPDIR`. It still requires the exact original checkout server symlink and refuses broken, foreign and non-symlink targets.
- `scripts/bostan-private-staged-full-app-acceptance.sh` obtains its stage root from the strict helper and checks >=4 GiB free space **on both the source build disk and the actual staging filesystem**, before expensive installation/build. The generated stage is created under the correct OS root. Cleanup is bound to that *specific* root and an exact eight-character random mktemp path; it will not recursively delete an arbitrary caller-provided directory.
- Source/default-mode behavior, versioned protocol formats, product identity, Postgres fixtures, compiled JavaScript, vendor code, privacy policy and UI were not modified.

## Evidence obtained on actual macOS arm64

- `node --test --test-concurrency=2 scripts/bostan-private-staged-full-app-acceptance.test.mjs scripts/bostan-private-staged-server-check.test.mjs scripts/bostan-local-http-postgres-smoke.test.mjs scripts/bostan-compiled-workspace-exports.test.mjs ui/scripts/bostan-private-staged-browser.test.mjs`: **17/17 PASS, 0 fail, 0 skipped**. Added a negative regression ensuring Linux/macOS root mapping, Windows rejection and `TMPDIR` independence. Verified exact original-source pnpm self-link safety and foreign-link refusal.
- Read-only `node scripts/bostan-private-staged-server-check.mjs --stage-root` on the Mac returned `/private/tmp`; `bash -n` PASS; `git diff --check` PASS.
- Re-ran the **entire real no-model macOS full-app source staging** on this revised branch:

```bash
bash scripts/bostan-private-staged-full-app-acceptance.sh --run
```

**Exit 0** (~105 seconds). Frozen offline pnpm install, compiled private Bostan server+DB health, production Vite UI, offline pnpm deploy, real 375 SQL migrations, 1,894 symlinks internal and 0 external, actual local PostgreSQL, **HTTP 200**, and headless Chromium `Bostan` UI first paint with **0 browser JS errors and 0 outbound requests**. The randomized owned staging directory was deleted on exit, and no process was left running. No model credentials used and no publishing.

The Mac staging run's free space temporarily fell below 4 GiB after compilation began, then recovered; the newly added 4 GiB admission applies **before** starting, not as a continuous runtime alarm. The Mac has limited disk/RAM. No external database, user installation, release action or production model was touched.

## Scope and remaining gates

**Linux path selection is unit-tested but NOT real Linux integration qualification.** A Linux runner still needs a frozen-dependency offline Vite/server/PostgreSQL/Chromium execution of this script, plus Rust native binary tests. The native Windows machine has only about 4.3 GiB RAM available and ~8.8 GiB free on D, no `initdb` / `pg_ctl` on PATH, and did not meet the existing Windows installer-capacity gate; we did not run an unqualified Windows installation. Peer dependency warnings, Linux/Windows signed deliverables, real free-model governed agent eval and independent security audit remain open. **Release NO-GO.**
