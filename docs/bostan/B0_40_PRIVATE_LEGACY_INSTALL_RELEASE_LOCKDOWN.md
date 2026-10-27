# B0-40 — Fail-closed Bostan public install/release entrypoints and Windows source preflight

Date: 2026-10-27. Private Draft PR stacked on B0-39. No merge into `main`, no public release, no inherited Actions enablement, no deployment, no paid models, no existing user-data mutations.

## Security finding and fix

The inherited source tree still had executable `scripts/install.sh`, `scripts/e2e-install-lifecycle.sh`, `scripts/release.sh` and `scripts/create-github-release.sh` entrypoints. Their donor-era bodies can contact the public donor distribution, install globally or create public npm/GitHub release artifacts if invoked unintentionally. A private Bostan package-level `prepack` guard alone cannot protect arbitrary shell scripts.

Added an unconditional Bostan-specific denial **immediately below the shebang** of each of these four shell programs, before executable shell logic, option parsing, network requests, global installs, git tagging or publishing. This deliberately refuses both ordinary runs and `--help`/`--dry-run` invocations because the inherited help and dry-run paths are not qualified Bostan product functionality. The original historical shell bodies remain inert pending safe Bostan-native implementation and separate review; mandatory attribution is not removed. The supported local alternative is `node scripts/bostan-no-model-acceptance.mjs --plan` or the explicit private `--run` modes.

## Verified on the actual Windows device `Abdulaziz`

- Clean shallow copy of private `TheHalfMoon/Bostan` at B0-39 `8ca9bb2` staged on a separate D: scratch path; no source under user HOME overwritten.
- Windows `node --test` with Windows ACL, host-readiness, local-stop and no-model-acceptance suites: **21/21 PASS**. Tests included real fail-closed ACL rejection/permissions on NTFS.
- Four shell guard suites execute the entrypoints through installed Git Bash under a new temporary HOME, with default, `--help`, `--dry-run` and `--yes`; all fail with status **2** and never write that HOME. Native Bostan QA plan invariants also verified: **5/5 PASS**.
- Native Rust `cargo fmt --manifest-path packages/paperclip-runner/runner/Cargo.toml --all -- --check`: **PASS**. Static Cargo workspace `cargo metadata --locked --offline --no-deps`: **PASS**. Neither result counts as Rust compilation.
- `git diff --check`: **PASS**.
- Windows host-readiness inspection correctly returned **NOT ready**: Node and total 15.7-GiB memory pass, but free memory (~2.7 GiB), C: temporary disk (~5.8 GiB), and D: staging disk (~8.2 GiB) remain below the conservative **6 GiB free RAM / 12 GiB per disk volume** qualification thresholds. The resource gate was not bypassed. No compilation or installed Windows E2E was attempted because doing so would violate the measured resource constraints.

## Remaining gates

Full Windows installed Bostan app, real Windows browser + PostgreSQL E2E, Rust compilation and native runner security test, retained legacy release automation audits, multi-OS installer/update/rollback, real free agent/model execution with independently persisted governed reports, and final independent security signoff remain **UNQUALIFIED**. Do not infer release readiness from this change. **Release NO-GO.**
