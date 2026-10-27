# B0-71 — Actual native Windows Bostan CLI installation in protected disposable TEMP QA

**2026-10-27.** Stacked Draft on B0-70 PR #219, base commit `84c27b2c17a21104fbfb2682f0a2dda8ba532e89`. Repo PRIVATE, GitHub Actions OFF, **no main merge, release, deployment, registry publication, paid models or real customer data**.

## Gap

The prior B0-60 and B0-67 Windows CLI admission ran 13 PASS and 13 deliberate SKIPs: on native Windows, `install --local` was refused. The real preview install, compiled CLI execution, installed ZIP inspection, offline launch, repeat-install refusal, tamper detection and source-staging removal had **not** been qualified on Windows. Host resources precluded attempting a full Windows server/UI/PostgreSQL install.

## Scope: private test-only installer, NOT consumer Windows support

The existing `cli/src/bostan-local-install.mjs` now admits `win32` **only** when `BOSTAN_WINDOWS_TEMP_QA=1` and HOME is a normalized synthetic test fixture nested under the operating-system TEMP directory: `bostan-native-install-test-*/home*`. It must be a real directory, not a symlink. Actual user HOME, unrelated folders, remote paths and all other Windows installs are **still refused** without writing user files. This is not a general Windows CLI installer and is not enabled by a standard install.

For disposable Windows QA only, the preview uses `.local/bin/bostan.cmd`, with a pinned absolute local Node executable and installed entry path; fails closed on CMD-sensitive path characters, refuses existing commands, respects one-use lock and hashed installed payload. The installed distribution now carries its own `dist/bostan-windows-acl.mjs` verifier, included in its payload digest and built/packaged manifest. No source checkout is needed afterward.

During installation, existing NTFS helper enforces protected DACLs (the invoking user, SYSTEM and Administrators; no broader principals) on **both** `.bostan` and `.local` before any managed payload/shim/manifest write. Status verification **rechecks** the DACLs on the installed artifact and refuses broadened permissions or modified bytes. The helper itself may be invoked directly only by explicit Windows TEMP-QA processes with a validated path; this does not expose an arbitrary NTFS permission rewriting command.

On macOS/Linux the POSIX shell shim and existing local installer remain intact; the bundled NTFS helper stays dormant.

## Test additions / real failures repaired

- Enabled actual native Windows preview installation tests on synthetic disposable homes: source and precompiled payload install, `.cmd` execution, genuine ZIP inspection, immutable SHA-256 payload, malicious command refusal, no remote provider, existing-file protections, installed-stage independence, paths with spaces/apostrophes and read-only status.
- Added Windows tests that deliberately inject a broader `Authenticated Users` ACE using `icacls`, then ensure Bostan **refuses** an installed status read instead of silently accepting the unsafe ACL.
- Added explicit test that even with `BOSTAN_WINDOWS_TEMP_QA=1`, attempting to install in the actual Windows HOME **fails**.
- First native Windows exploratory execution had a **CMD invocation quoting problem in the test harness**, yielding six failures; fixed via verified `windowsVerbatimArguments` handling for the synthetic `.cmd` launcher. A second iteration found staged install initially depended on source ACL code; the final self-contained CLI now bundles the verifier. Failed exploratory runs were not counted as green evidence.
- On this Windows host, three adversarial symlink-creation cases cannot execute because Developer Mode/symlink privilege is unavailable. These are **explicit SKIPs**, not evidence of symlink-path safety beyond the underlying `fs.lstat` refusal implementation.

## Executed exact source tests

| OS | Native Node.js | Real private CLI acceptance | FAIL | SKIP |
| --- | --- | ---: | ---: | ---: |
| macOS arm64 | v26.0.0 | **25 PASS** | 0 | 3 Windows-specific tests |
| Windows 11 / Abdulaziz | v24.19.0 | **24 PASS** | 0 | 4 Windows symlink/host cases |
| Ubuntu Linux x86_64 WSL2 | Official free Linux v24.19.0 | **25 PASS** | 0 | 3 Windows-specific tests |

All complete CLI gate test runs emitted `BOSTAN_PRIVATE_CLI_PLATFORM_ACCEPTANCE_PASS`. The Windows core native installer-focused retake had **18 PASS, 0 FAIL, 3 SKIP** before the company ZIP suite was added for the full 24 PASS outcome. The Windows tests used the user's authorized native Windows machine with disposable `%TEMP%` folders, not the user's actual HOME. Linux uses a real official Linux Node binary, not Node22 or the Windows Node executable. No npm registry publication, cloud AI provider request, telemetry or real production database occurred.

### Reproduction

```sh
node scripts/bostan-private-cli-platform-acceptance.mjs --plan
node scripts/bostan-private-cli-platform-acceptance.mjs --run
```

The `--run` mode is explicit. Its dependency/manifest gate checks all 48 Bostan source packages remain Bostan-named, private and blocked from public registry publication before any tests. The normal mode is read-only. Windows tests automatically choose their own synthetic disposable QA HOME.

## Remaining qualification gaps

Native Windows *consumer* CLI installation is not qualified; an end-user installer would need a separately reviewed and tested stable user-home security model, robust Windows shell argument handling, signed package/delivery design and system-wide threat modelling. No claim of native installed Windows Bostan **server, UI or AI runner**, or complete Linux installed full application. Free-model governed agent task completion, all dependency license/NOTICE and independent security release checks remain OPEN. **Do not publish. Bostan release NO-GO.**
