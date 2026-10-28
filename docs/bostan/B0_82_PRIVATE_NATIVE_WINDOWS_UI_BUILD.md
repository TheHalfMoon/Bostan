# B0-82 — Native Windows 11 private Bostan frontend qualification

**2026-10-28**. Private stacked Draft over B0-81 PR #230 (`72cb8894a74acfc4cda91414921e6530948e6511`). GitHub repository PRIVATE, GitHub Actions disabled, no `main` merge, paid model calls, public release or customer data.

## Why this matters

B0-60 already qualified native Windows Node CLI negative installation/file-safety tests (13 passes and 13 skips), but did **not** build or typecheck the real production UI on Windows. B0-75 through B0-77 qualified a real production compiled app + PostgreSQL + Chromium browser on native Linux ext4. Neither result proves that the Windows 11 native Vite/Rolldown and TypeScript toolchain can build the end-user frontend.

## New fail-closed reusable gate

`scripts/bostan-private-windows-ui-qualification.mjs` is **read-only by default**: no arguments or `--plan` describe the scope. Explicit `--run` is accepted **only on native Windows Node >=24**, with exact private `bostan` and `@bostan/ui` manifests, both registry-release deny hooks intact, at least 3 GiB physical free on the checkout volume and no inherited upstream Cloud environment signals. The child process strips provider credentials and telemetry exporters and uses offline npm mode; it executes only:

1. `pnpm --filter @bostan/ui typecheck` — generates the project's Storybook catalog and runs the actual TypeScript build;
2. `pnpm --filter @bostan/ui build` — actual production Vite/Rolldown frontend build.

After success it verifies that the realpath of `ui/dist` remains inside the checkout, that `index.html` identifies **Bostan**, and that JS and CSS bundles exist. Does **not** run a provider, a database, an installer, a registry publish or a server.

## Verification

- Mac ARM64 Node26: new safety/default-inert/negative tests **3/3 PASS**, plus B0-81 root-command tests **3/3 PASS**. `node --check` and `git diff --check` passed.
- Windows 11 `Abdulaziz`: native Node24.19/pnpm9.12, checkout at exact B0-81 source, scoped **frozen-lockfile, ignore-scripts** install of `@bostan/ui...` in a temporary D: package store and TEMP. This is **not a release artifact**. Document its actual exit status and then run the new explicit Windows UI gate on the same source before marking PASS.
- If Windows UI fails from a native binding or missing compiler dependency, mark fail and keep release NO-GO. Do **not** silently substitute a Linux/WSL build or skip TypeScript.

## Open work

The Windows UI build gate is **not** a complete native Windows installed app, actual local PostgreSQL+authenticated HTTP/Chromium on Windows, signed installer or a successful free-model agent. Those and third-party dependency license/security audit remain OPEN. No publication permitted.
