# B0-65 — Complete private-workspace registry publication quarantine

**2026-10-27.** Stacked private Draft over B0-64 PR #213, baseline `867806bfa4847dd2413ee8abdbc6e43bd407df1c`. Keep repository PRIVATE, inherited GitHub Actions disabled, do not merge main, publish a package, create a release, deploy, call paid services, or use real user data.

## Real issue discovered

Forty-six of forty-eight git-tracked `package.json` files already explicitly declared `private: true`. The exceptions were first-party `@bostan/skills-catalog` and `@bostan/teams-catalog`. Both lacked the `private` flag and retained a `publishConfig` block explicitly setting public npm registry access. Neither package had the standard Bostan `prepack` or `prepublishOnly` fail-closed hook. The inherited CI release manifest already set `publishFromCi=false` for both, but that protects only that release path, not an individual direct npm publish/pack action.

This work fixes an actual *publish eligibility* configuration problem. It makes **no** claim that either package was published or that anyone accessed a registry.

## Changes

- Both Bostan catalogs now declare **`private: true`**, have no `publishConfig`, and run the existing `scripts/bostan-release-disabled.mjs` in **both** `prepack` and `prepublishOnly`.
- Their exports, package versions, catalog keys, `catalog.json` structure, source paths, compiled runtime entrypoints and bundled dependencies are preserved. No persistent identifiers or donor legal notices were altered.
- `scripts/release-package-map.mjs` explicitly recognizes the two catalogs as *intentionally private* legacy-inventory entries. Its source-derived release plan now correctly contains **zero public packages**. The old release manifest entries remain present with `publishFromCi=false`, so historical inventory compatibility is preserved.
- Previously stale `scripts/release-package-map.test.mjs` expectations for public catalogs now assert **zero public inventory** and exactly configured private Bostan catalogs, without weakening the existing disabled-release checks.
- New read-only gate `scripts/bostan-private-workspace-registry-gate.mjs` checks **all git-tracked nested package manifests**, not only packages matched by pnpm-workspace.yaml. It requires every package to have `private: true` and **no** `publishConfig`; checks both catalog-specific pack/publish blockers and the inherited release map. Unknown flags fail closed. Default is an inert plan; `--check` is explicit and network-free.

## Actual verification on macOS arm64

- Six relevant Node test suites: **38/38 PASS**, zero fail and skip, including new pure negative cases for missing/private-false/publishConfig, mutated pack hooks, historical release map and identity checks.
- `node scripts/bostan-private-workspace-registry-gate.mjs --check`: **EXIT 0**, `trackedManifestCount=48`, `quarantinedCatalogs=2`, **48/48 explicitly private**, and no public publishConfig.
- `node scripts/release-package-map.mjs check`: **EXIT 0**, **zero** public release plan candidates.
- Both actual catalog blocker hook invocations: **exit 2** (deliberate rejection, no package published).
- Frozen/offline scoped pnpm workspace installation `pnpm install --offline --frozen-lockfile --ignore-scripts --filter '@bostan/skills-catalog...' --filter '@bostan/teams-catalog...'`: **EXIT 0**. No lockfile change required.
- `pnpm --filter @bostan/skills-catalog typecheck` and `pnpm --filter @bostan/teams-catalog typecheck`: **both EXIT 0**. No actual registry network requests or upload executed.

## Open license/source attribution work

The inventory reports **40 manifests with explicit license fields** and **8 without**, which is **not** a determination that eight packages violate license terms. The missing declarations are the private root, private runner distribution fixture, private fake-sandbox plugin, three private example plugins, private Cloudflare bridge-template fixture and private Speko voice-proof fixture. Upstream license notices, including the original MIT copyright, must remain intact where required. This phase makes no unsupported legal/third-party licensing-completeness claim; the gate deliberately reports `thirdPartyLicenseReviewComplete=false`.

## Boundaries and next qualifications

Registry publication quarantine is now covered across tracked source manifests and the two catalog pack/publish hooks, but this alone does **not** prove every other packaging entrypoint or inherited GitHub workflow is safe if a human reenables it. Reproducible full Windows/Linux installed app lifecycle, real governed zero-cost agent completions, full source + bundled dependency notices, legal/security release reviews and larger workload qualification remain OPEN. **Do not release.**
