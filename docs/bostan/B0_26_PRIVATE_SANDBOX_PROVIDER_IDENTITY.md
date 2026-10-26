# B0-26 — Eight native private Bostan sandbox provider identities

Private, no-release engineering, 2026-10-26. Stacked after Draft PR #174 (B0-25). Never merge into `main`, publish/deploy packages, enable inherited GitHub Actions or invoke paid sandbox/model services.

Eight independently installable sandbox provider plugin packages now use `@bostan/`: Cloudflare Sandbox, CreateOS, Daytona, E2B, exe.dev, Kubernetes, Modal and Novita Sandbox. Provider product names remain correct third-party identifiers, but package scopes, owned README descriptions and source-facing package names are Bostan. Package repository/homepage/bug metadata points to private `TheHalfMoon/Bostan`. Third-party licenses/attribution are not altered.

The workspace deliberately excludes `packages/plugins/sandbox-providers/**` from root pnpm dependencies; this migration does not claim that all eight provider SDKs have been reinstalled or exercised live. Each provider is `private:true`, has **no `publishConfig`**, and both `prepack` and `prepublishOnly` invoke the nonzero Bostan release-disabled guard. Removed inherited mutating `postpack`. All eight private providers have been removed from the legacy public-release inventory entirely; the remaining inherited manifest entries remain `publishFromCi:false`. Inherited workflow files remain disabled. Actual live provider billing credentials/services were not invoked.

Exact package names updated in active integrations and qualification fixtures, including Daytona plugin loader, installed provider tests, server authz routes, UI tests, stable Vitest workspace lane and Docker/workflow-adjacent test expectations. Versioned `paperclipPlugin` metadata schema **intentionally remains** for compatibility; no silent key/schema rename. Existing stored installs using inherited package names require an explicit audited migration or compatibility layer before any release, not an unreviewed silent database rewrite.

The inherited Runner qualification retention helper now **rejects private Bostan Daytona at entry, before any output directories or npm packaging**, with a fixture test proving it leaves the source unchanged. This does not enable any public-release workflow.

Source-level regression covers the eight private package identities, release hooks, ownership metadata, absent public inventory entries and preserved persisted metadata shape. Native Windows app, paid provider integration E2E, installed sandbox packages, full server TypeScript/build, independent governed Case and security signoff are still unqualified. **Release NO-GO.**

## Verification evidence (Mac local)

- 74 focused Node test cases across package identity, private-provider guard, disabled release manifest, standalone retention fail-close, SDK and stable workspace-shard tests: PASS after adding guard-exit assertion; no actual npm pack, publish, or cloud credentials used.
- 14 local npm registry authority/dependency validator tests PASS after covering native `@bostan/` internal dependencies as well as legacy compatibility; no live package publication or hosted registry writes.
- Inherited public canary registry verification tests are not considered passing: 13 legacy positive publishing tests currently assume at least one `publishFromCi:true` public canary, but Bostan intentionally has none. These are separate blocked release-path tests, not approval to re-enable publication.
- Full server production build, Windows-installed GUI and live independent model-authored qualification remain unqualified.
