# B0-43 — Keep native private Bostan CLI manifest immutable against donor npm generator

2026-10-27. Draft-only private stacked PR above B0-42. Do not publish, deploy, merge `main`, enable inherited Actions, consume paid services or mutate user installations.

## Finding

The inherited `scripts/generate-npm-package-json.mjs` is a directly executable Node generator which **overwrites `cli/package.json` by default** with a public-publishable package manifest and can also write an arbitrary `--output` path. Bostan's actual `cli/package.json` is private (`name=bostan`, `private=true`) and has an explicit `bostan-release-disabled.mjs` `prepack`/`prepublishOnly`. This generator could strip private release protections or recreate donor-era public package artifacts even after B0-40/B0-42 blocked direct public shell/NPM entrypoints. Its only known direct consumers are inherited public-install tooling, which Bostan does not support.

## Fix

Added an unconditional fail-closed Bostan refusal immediately after the generator's shebang, before reading or writing manifests. The historical generator implementation remains as source/provenance only; supported Bostan source build/doctor and QA flows are unaffected. No supported `--output`, `--help` or default execution path may recreate a publishable manifest.

## Executed evidence

- `node --test scripts/__tests__/bostan-legacy-manifest-generator-denied.test.mjs scripts/__tests__/bostan-direct-public-release-escape-gates.test.mjs scripts/bootstrap-npm-package.test.mjs`: **19/19 PASS**.
- Guard test executes generator with default, `--help` and an explicit scratch output path, asserts exit `2`, no output produced and the real private `cli/package.json` remains **byte-identical** before/after each attempt. `private=true`, name `bostan`, and the disabled prepack guard are verified.
- Direct B0-42 inherited-shell guard unit suite also made portable to native Windows using Git-for-Windows Bash (never WSL bash.exe), while preserving strict fail-closed behavior. macOS **19/19 PASS** after the portability change.
- `git diff --check`: PASS; no registry access, local npm pack/publish or external model calls.

## Not release approval

The repository retains historical release code, versioned compatibility protocols and legally required donor attribution. Additional deployment workflows require their own audit. Full native Rust compilation, installed multi-platform E2E, real model and independent security assessment remain open. **Release NO-GO**.
