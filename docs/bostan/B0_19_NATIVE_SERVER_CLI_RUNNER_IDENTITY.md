# B0-19 — Native Bostan server package and CLI provider identity

Private Bostan engineering, October 26 2026. Stacked Draft after B0-18 PR #167. Do not merge to main, publish, deploy, enable inherited GitHub Actions, use paid inference or remove legal source notices.

## Change

The core server package was still named `@paperclipai/server` while root CLI, UI and the two catalogs already used Bostan package identities. This is a real runtime defect for native brand migration: installed Bostan CLI resolves the server dynamically, requires exact package-manifest identity, and passes provenance to pinned runner sidecars and provider-root security guards.

This branch migrates the owned source server package to `@bostan/server` across 64 actively referenced code/command files, root dev/build/test selectors, CLI dependencies, CLI dynamic imports and setup checks, runner provider package-root and asset provenance guards, validated test fixtures, build scripts, release inventory and current development documentation.

The server itself is now PRIVATE, with Bostan repository links, no `publishConfig`, prepack/prepublish-only hard disabled and no postpack mutation. It is not a public `@bostan` npm release and cannot be presented as one. Old donor npm release registry fixtures and some third-party/history references are not fictitiously treated as Bostan published artifacts. The exact old installed server package identity is no longer admitted as the new first-party server in the migrated runtime security guards; explicit upgrade/dual-read acceptance must be designed separately before any installed production migration.

The workspace pnpm importer formerly referenced `@paperclipai/server`. Its single lockfile workspace entry is now `@bostan/server`, with the same underlying `link:../server` path and no third-party package version change. `pnpm install --lockfile-only --offline --ignore-scripts --frozen-lockfile` and then a no-script frozen relink both PASS. The CLI's actual `node_modules/@bostan/server` symlink points to the server checkout.

## Actual qualification

- Identity/legacy release map source tests 19 PASS, no failure; inherited CI publication entries remain disabled.
- Mac Bostan source Node suite including guarded release paths: 209 PASS, 0 FAIL, 10 SKIP (219 total).
- CLI real TS compiler `pnpm --filter bostan run typecheck`: PASS.
- CLI package install/run/runtime tests: 27 PASS, 0 FAIL.
- Runner standalone provisioning and package-owner smoke: 9 PASS, 0 FAIL.
- Four runner security Vitest files: 102 PASS, **2 FAIL**, 6 SKIP. Both failures relate to Node's post-renaming parent-relative/ancestor module resolution, and the EXACT same two tests were reproduced failing on a disposable independent worktree of the parent B0-18 commit **47943cb**, under the same installed Node/runtime. This is an inherited blocker, NOT a green runner security suite, and must be fixed before final release qualification. The test-only baseline worktree was removed after proof.
- Five canonical governed Case / JWT / real PostgreSQL / native bridge integration files: 22 PASS, 0 FAIL.
- Real source Bostan HTTP/PostgreSQL clean stop/restart, persisted synthetic company and headless Chromium under the Bostan server identity: PASS, browser page errors 0, blocked external requests 0.
- Windows source validation and exact-head results are appended upon successful verification.

## Open NO-GO

Full official server TypeScript/build on a resource-qualified host remains unqualified (current Mac memory is insufficient for its prior attempted full server compile), native independently model-authored signed governed Case closure unqualified, full Windows installed-app E2E unqualified, the inherited 2/110 runner security test failures remain unresolved, whole-host egress/agent security audit remains open. Also the shared, DB, adapter, plugins, protocol, assets and historical material have not all been migrated into Bostan-first package identities. B0-09 remains OPEN.

No publication, deployment, release artifact or main merge.
