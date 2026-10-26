# Bostan — private release quarantine

Bostan is under active development in a private repository. Do NOT publish, pack,
deploy, release, dist-tag, or enable inherited GitHub Actions. There is no
approved Bostan npm registry channel, release package signer, or public package
owner at this time.

The product command is `bostan`. The board UI is the private `@bostan/ui`
workspace package, and the two bundled catalog packages are
`@bostan/skills-catalog` and `@bostan/teams-catalog`. These are
source/workspace identities, **not** assertions that any @bostan npm scope or
registry has been published or claimed.

All inherited package publication entries are disabled in
`scripts/release-package-manifest.json`.
`node scripts/release-package-map.mjs check` verifies the private inventory.
`list` and `set-version` intentionally refuse to create a release plan.
The CLI and UI packaging scripts intentionally fail using
`scripts/bostan-release-disabled.mjs`; there is no Bostan release artifact
qualified by this source code.

Required copyright, license and source provenance notices remain intact.
Historical release details from the upstream source are not actionable release
instructions for Bostan.

Prior to approving ANY release, separately qualify package ownership,
signing and distribution, clean builds, application E2E (including Windows),
real autonomous governed Case closure, independent security review, upgrade
and rollback, and explicit founder authorization.

**Current decision: NO-GO.**
