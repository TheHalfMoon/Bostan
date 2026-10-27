# B0-42 — Retire secondary public npm, release and managed-update escape paths

Date: 2026-10-27. Private stacked Draft above B0-41. Do not deploy, publish, merge `main`, enable inherited Actions, pay for external models, or alter user-managed data.

## Finding

B0-40 stopped four top-level inherited donor shell entrypoints. A direct-invocation audit found four **additional** paths that could still perform donor public registry operations or damage a locally managed install if invoked independently:

- `scripts/rollback-latest.sh` can alter the npm `latest` dist-tag.
- `scripts/bootstrap-npm-package.mjs --publish` can register placeholders and deprecate them in a public namespace.
- `scripts/build-npm.sh` can generate and mutate a donor-era npm package in the checkout for subsequent distribution.
- `scripts/e2e-update-migrations.sh` targets the donor's hosted/managed installation path and manipulates service/database update+rollback states.

## Change

All three shell programs now **fail closed immediately below their shebangs**, before environment reading, option parsing, `npm`, git, downloads, filesystem mutation or service actions. The JavaScript bootstrap retains its exported pure helpers for historical compatibility/unit tests but denies **any direct CLI invocation** before calling its registry-reading or publishing routine. Both Bostan and donor package names are refused by direct execution (even if `--dry-run` or `--help` is supplied). This is intentional: the legacy help and dry-run flows can advertise unsupported public Bostan release paths. The historical bodies/provenance and required legal attribution remain preserved in source, but inactive.

Repaired a pre-existing misleading bootstrap test that claimed the legacy helper accepted donor-scoped names but supplied `@bostan/*` names. The corrected test asserts that donor-scoped historical validation is unchanged and that Bostan package names are rejected by that helper. In any case, the executable direct bootstrap is always disabled.

## Verified locally on authorized macOS, no external services

- `node --test scripts/__tests__/bostan-direct-public-release-escape-gates.test.mjs scripts/bootstrap-npm-package.test.mjs`: **18/18 PASS**, including all four denied entrypoints, options/default, synthetic disposable HOME and old pure-function tests.
- `bash -n` on all three guarded shell files: **PASS**.
- `git diff --check`: **PASS**.
- Native `scripts/bostan-no-model-acceptance.mjs` remains independent, with read-only `--plan` and explicit disposable opt-in test scenarios. We did **not** attempt to publish, install from a public registry or run Rust.

## Remaining gates

The repository has additional inherited release/CI fixture scripts, versioned compatibility manifests and third-party notices; these need separate targeted audits, not blanket search/replace. No change to product dependencies, database migrations, packages or versioned wire formats. Installed Windows/macOS/Linux app flows, native Rust build, real model efficacy, governed case execution and final security review remain **OPEN**. **Release NO-GO**.
