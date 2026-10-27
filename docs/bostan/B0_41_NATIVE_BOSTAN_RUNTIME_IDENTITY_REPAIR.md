# B0-41 — Native Bostan runtime identity and package-resolution repair

Date: 2026-10-27. Private Draft PR stacked on B0-40. No `main` merge, public registry publishing, deployment, inherited GitHub Actions activation, paid model or existing user-data mutation.

## Faults discovered by a real native Windows source audit

A nine-suite source regression run initially passed 51/52 tests and identified a stale first-party identity assertion: `scripts/bostan-visible-branding.test.mjs` still expected `@paperclipai/shared` despite the shipped Bostan-owned TypeScript import `@bostan/shared`. Follow-up review found deeper product consequences of incomplete first-party namespace migration:

- `server/src/services/native-runtime/remote-pi-companion.ts` enforced a donor-only installed server npm name `@paperclipai/server` even though the actual private server is **`@bostan/server`**. This would prevent signed/verified Pi companion imports on macOS/Linux. Changed to a *strict native Bostan equality check*, without relaxing any authority, checksum, source-revision, sandbox or archive validation. Left `paperclip.remote-pi-companion/v1`, imported provider-pack schema and native daemon path unchanged as versioned compatibility identifiers.
- Updated the synthetic Pi companion fixture to a native Bostan server and added a negative test requiring explicit rejection of the donor server identity, without manufacturing any cache destination. That platform-specific full suite still requires macOS/Linux and has **not** been run on Windows.
- Fixed `cli/src/commands/install.ts` workspace dependency traversal to detect native `@bostan/` packages in addition to inherited aliases, so source closure cannot silently omit `@bostan/shared` or `@bostan/db`. Did not activate or publish the retired public installer; B0-40 continues to deny the old shell paths.
- Fixed user-facing Node runtime warning copy, process-global warning symbol, and installation-guide URL to name Bostan and describe its private source workflow, not obsolete downloaded donor installation. Adjusted matching CLI warning expectations.
- Fixed the Plugin Manager's example npm name to `@example/bostan-plugin` and the plugin-loader documentation comment to `@bostan/plugin-*` without asserting a nonexistent published Bostan package.
- Corrected branding regression assertions to distinguish deliberately retained persisted compatibility keys from actual first-party npm import names.

## Evidence

- Windows `node --test` on nine existing source identity/security suites plus the new `bostan-runtime-identity-regressions.test.mjs`: **56/56 PASS, 0 skipped, 0 failed**. The prior 51/52 finding is repaired.
- New pure Node 24 dynamic TypeScript test verifies the **actual `formatNodeVersionWarning` implementation** with no npm dependencies or network; file contract checks assert strict Pi-server product ownership, inherited protocol stability, plugin names and Bostan dependency traversal.
- `git diff --check` PASS. No heavy builds or source installer usage.
- The remote Pi companion fixture negative test was authored but **cannot be counted as executed evidence** until the native macOS/Linux platform-specific suite runs. The Windows qualification capacity gate remains blocked (free RAM and staging/TEMP storage below threshold), so no installed Windows E2E or Rust compilation is claimed.

## Remaining release gates

Full real Linux/macOS Pi companion import, Native Rust, Windows installed lifecycle, a model-authored governed Case with evidence, independent security signoff and a separate qualified installer/publication plan remain open. **Release NO-GO.**
