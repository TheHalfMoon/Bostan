# B0-82 — Native Windows 11 private Bostan frontend qualification

**2026-10-28**. Private stacked Draft over B0-81 PR #230 (`72cb8894a74acfc4cda91414921e6530948e6511`). GitHub repository PRIVATE, GitHub Actions disabled, no `main` merge, paid model calls, public release or customer data.

## Why this matters

B0-60 already qualified native Windows Node CLI negative installation/file-safety tests (13 passes and 13 skips), but did **not** build or typecheck the real production UI on Windows. B0-75 through B0-77 qualified a real production compiled app + PostgreSQL + Chromium browser on native Linux ext4. Neither result proves that the Windows 11 native Vite/Rolldown and TypeScript toolchain can build the end-user frontend.

## New fail-closed reusable gate

`scripts/bostan-private-windows-ui-qualification.mjs` is **read-only by default**: no arguments or `--plan` describe the scope. Explicit `--run` is accepted **only on native Windows Node >=24**, with exact private `bostan` and `@bostan/ui` manifests, both registry-release deny hooks intact, at least 3 GiB physical free on the checkout volume and no inherited upstream Cloud environment signals. The child process strips provider credentials and telemetry exporters and uses offline npm mode; it executes only:

1. Validate **runner source-only transitive compile dependencies** `ajv/dist/2020.js`, `json-schema-to-ts`; reject missing scoped-install prerequisites (no network or silent repo mutation).
2. `pnpm --filter @bostan/plugin-sdk build` — builds the actual plugin SDK UI export and shared dependency; `--ignore-scripts` intentionally does not compile it on install.
3. `pnpm --filter @bostan/ui typecheck` — generates Storybook catalog and runs actual TypeScript build.
4. `pnpm --filter @bostan/ui build` — actual production Vite/Rolldown frontend build.

After success it verifies that the realpath of `ui/dist` remains inside the checkout, that `index.html` identifies **Bostan**, and that JS and CSS bundles exist. Does **not** run a provider, a database, an installer, a registry publish or a server.

## Verification

- Mac ARM64 Node26: new safety/default-inert/negative tests **3/3 PASS**, plus B0-81 root-command tests **3/3 PASS**. `node --check` and `git diff --check` passed.
- Windows 11 `Abdulaziz`: native Node24.19/pnpm9.12, checkout at exact B0-81 source, scoped **frozen-lockfile, ignore-scripts** install of `@bostan/ui...` in a temporary D: package store and TEMP. This is **not a release artifact**. Document its actual exit status and then run the new explicit Windows UI gate on the same source before marking PASS.
- If Windows UI fails from a native binding or missing compiler dependency, mark fail and keep release NO-GO. Do **not** silently substitute a Linux/WSL build or skip TypeScript.

## Open work

The Windows UI build gate is **not** a complete native Windows installed app, actual local PostgreSQL+authenticated HTTP/Chromium on Windows, signed installer or a successful free-model agent. Those and third-party dependency license/security audit remain OPEN. No publication permitted.

### Initial native Windows failure and required repair

The initial frozen **UI-only** scoped install completed **902/902 packages** in 4m 10s but intentionally skipped package build scripts. The first actual native Windows UI typecheck **FAILED exit 1**, not a pass: `@bostan/runner` source imports could not resolve `ajv/dist/2020.js` or `json-schema-to-ts`; the UI could not resolve `@bostan/plugin-sdk/ui` because the SDK's `dist/ui` had not been built. These were incomplete QA build prerequisites, not verified application source defects. B0-82 now preflights runner dependency presence and explicitly builds the SDK before typecheck. The Windows QA runner store is being augmented with the pinned runner dependency closure; **record the actual retake output before calling Windows qualified**.
