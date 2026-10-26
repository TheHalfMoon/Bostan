# B0-16 — Bostan catalog package identity and private release hard stop

Private Bostan engineering, 26 October 2026. Stacked Draft on B0-15 PR #164. No merges to main, product publication, deployment, inherited GitHub Actions, paid model runs, deletion of user data or removal of required upstream legal notices.

## User-approved product identity boundary

Bostan is the ONLY future product identity for owned packages, CLI, UI, commands, documentation, install artifacts and release paths. This branch makes a real workspace package migration rather than merely replacing rendered labels. It is an **increment**, not completion of B0-09 (#35): many other workspace package names, persisted protocol identifiers, app screens, legacy release files and original source documentation still need qualified migrations.

## Concrete package migration

- Rename two **owned npm package manifest identities** to `@bostan/skills-catalog` and `@bostan/teams-catalog`.
- Replace exact old package-specifier references in the 38 tracked files that mentioned them: server dependencies, real TypeScript imports, generated catalog manifest headers, schema type for teams-catalog, root lockfile importer, catalog tests, product documentation and release package mapping.
- Update catalog package repository/homepage/bugs metadata to the actual `https://github.com/TheHalfMoon/Bostan` repository.
- Preserve package filesystem paths and exports; update the two catalog package scripts to use the installed workspace server TSX loader rather than a nonexistent `cli/node_modules` path on this source checkout.
- Include the teams catalog in root Vitest project list so both packages actually run in source tests.

### Persistence and historical provenance

Catalog **item keys and IDs** such as `paperclipai/bundled/company-defaults/core-exec-team` and `paperclipai/bundled/docs/doc-maintenance` are persisted references within previously saved user data. We DO NOT silently rename them as part of the npm namespace change. The new regression explicitly requires these historical keys to remain readable. A future **dual-read, Bostan-one-write, migration receipts and rollback** plan must be qualified before switching the persistent source key scheme. Likewise, genuine donor license/NOTICE metadata and real third-party systems are not falsely claimed to be Bostan.

## Inherited release quarantine — NO publish

The previously inherited package release manifest had **29 packages enabled** for CI publishing while the real Bostan CLI is `private:true` and its prepack/prepublish hooks explicitly block releases. This incompatible state caused the release-map unit suite to fail because the legacy mapper expected the private CLI to be a publicly published channel entrypoint.

Now:
- Every inherited release manifest entry has `publishFromCi:false`.
- The private `bostan` CLI is admitted into the release inventory ONLY as a non-publishable private entry.
- `node scripts/release-package-map.mjs check` validates the map without enabling releases.
- `list`, `set-version` and every attempted `getReleasePackages` call fail closed with a Bostan publication-disabled error. There is no automatic unblocking based on environment or owner names.
- GitHub Actions remain disabled at repository level. Do not rename the inherited third-party repository-specific CI release ownership guards to Bostan, because doing so could accidentally activate an upstream publishing workflow.
- The release-map tests assert that no packages may be published by the inherited pipeline and that both new Bostan catalog packages are present.

This is a safe, **non-release** private product identity migration. It does not claim ownership of an npm `@bostan` publishing namespace; private source usage only.

## Actual qualification in this branch

- Both renamed catalog packages found by the pnpm workspace with their new names.
- `pnpm install --lockfile-only --offline --ignore-scripts --frozen-lockfile`: PASS.
- The initially incomplete local pnpm store was missing 47 normal public dependencies. `pnpm install --prefer-offline --ignore-scripts --frozen-lockfile` installed those dependencies through the standard public npm registry with NO postinstall scripts and no paid services: PASS.
- `pnpm --filter @bostan/skills-catalog run validate`: PASS, 17 catalog skills.
- `pnpm --filter @bostan/teams-catalog run validate`: PASS, 5 catalog teams.
- Both catalog TypeScript **build** commands regenerated their current manifest and compiled successfully.
- Root Vitest scoped catalog tests: **18 PASS, 0 FAIL**, covering real stored manifests, cryptographic file inventory and preserved legacy item IDs.
- Real server catalog source/integration on the renamed package imports: **18 PASS, 0 FAIL** in two canonical test files, including actual company-skill installation, safe source materialization and provenance.
- Mac source Node + legacy release-map tests: **194 PASS, 0 FAIL, 10 SKIP** (204 total) before the four extra Bostan product identity checks.
- New product identity tests: **4 PASS, 0 FAIL**, including CLI name, package owner, current generated manifest and fail-closed release manifest.
- Complete server build, installed Windows application, real independent model-authored signed Case and comprehensive external audit still unqualified. Additional exact-head testing noted after execution.

## Remaining scope

B0-09 remains open: after the two catalog packages, the majority of owned first-party packages still use inherited internal identities. Some of those references are pure internal imports but others represent user-visible names, stored schema IDs, package release paths or third-party URIs. They require inventory, bounded migration, workspace lock updates, explicit compatibility strategy and real tests. Do not claim branding complete until an audit across owned packages, UI/SEO, documentation, CLI/help, install artifacts and release targets is clean, with only documented compatibility and legal exceptions.

Release NO-GO, repository PRIVATE, Actions OFF, main unchanged.
