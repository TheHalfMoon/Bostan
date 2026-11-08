# B0 — Front door identity: implementation receipt

**Status:** implemented in an isolated development branch; not a product release.

## Exact input

- Bostan `main` parent at start: `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a`.
- Complete imported foundation recorded in `docs/bostan/FOUNDATION_AND_MIGRATION.md`.
- Work branch: `work/b0-rebrand-identity`.

## Changes

- Bostan app title, app-install manifest, favicon and browser fallback.
- Product lockup in local sign-in and Bostan-branded loading component.
- No inherited product logo in these selected shell components.
- Worktree-preview favicon generator now renders a Bostan initial.
- Compatibility preserved for server runtime branding sentinel comments, `PAPERCLIP_*` environment variables and existing local storage keys; they are not currently product-visible.
- Deliberately no upstream SaaS integration changes, database migrations, package-scope renaming or remote model/network claims.
- Neutral initial mark only; not a final approved logo.

## Performed checks

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts --prefer-offline` | PASS; inherited generated-bin warnings expected from ignored scripts |
| `node scripts/check-bostan-frontdoor.mjs` | PASS |
| Targeted `vitest` BostanLockup, BostanLoading, server UI-branding | 3 files, 11 tests PASS |
| `pnpm --filter @paperclipai/plugin-sdk ensure-build-deps` | PASS |
| `pnpm --filter @paperclipai/ui typecheck` | PASS after SDK build |
| `pnpm --filter @paperclipai/ui build` | PASS; nonfatal large JS chunk warning |
| Vite preview on loopback: GET / | HTTP 200; HTML title Bostan |
| Vite preview loopback manifest and favicon | Bostan name and aria label verified |
| `git diff --check` | PASS |

Important nuance: the first isolated `ui typecheck` failed because the plugin SDK build products were absent after `--ignore-scripts`; this resolved after running the intended SDK preparation. It was not a TypeScript source regression.

## Remaining before identity completion

The original package scope `@paperclipai/*`, CLI command, asset filenames, end-user copy elsewhere in the application, production deployment workflows, startup env/default databases, external links, updater URLs, privacy/telemetry behavior and executable runtime have **not** been rebranded or qualified. Do not remove provenance or legal notices. CI is disabled at repository level until inherited automation is reviewed. No full unit suite, cross-company data isolation, database boot, agent execution or live release qualification was performed.

**Never mark B0 or the whole product complete from this receipt alone.**
