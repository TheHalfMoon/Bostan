# B0-78 — First-party Bostan connection/OAuth UI branding (not external integration spoofing)

**2026-10-28.** Private stacked Draft on B0-77 PR #226 (head `a4eced2c2fc1552bb1207373ee5f0ec86c7b0054`). Keep repo **PRIVATE**, GitHub Actions **OFF**, no merge to main, paid AI, customer data or public release.

## Code changes

Updated **32 first-party text/comment occurrences** in `ui/src/features/connections/ConnectionSetupFlow.tsx` to call the software **Bostan**, not a donor: generic MCP auto-discovery and authorization hints, credentials storage, permission copy, guided setup, callback URL labels and registration instructions, preserved-connection error UX, OAuth launch/progress/error descriptions, managed Asana/Vercel setup descriptions. No URLs, callback values, credentials, OAuth scopes, provider package IDs, API routes, test fixtures, persistence keys, domain names or backend protocol fields changed.

**Critical safety/accuracy boundary:** Seven existing mentions of the real external **Paperclip Cloud/GitHub App enrollment** are deliberately unchanged. They describe upstream account enrollment or installation requirements still present in the application; relabeling them "Bostan" without replacing the actual account/API/GitHub app integration would mislead users or break provider identity. Backend and first-party connected-provider replacement for those external services is **OPEN** and must be treated as an explicit product/release gap. Required third-party licenses, origin attribution and compatibility protocol fields remain untouched.

## Actual tests

- New focused source behavior/branding regression tests `scripts/bostan-connection-first-party-brand-copy.test.mjs`: **3/3 PASS**, verify native Bostan copy, explicit external-service identity exceptions, and preserved OAuth/connector wiring.
- Existing React/feature OAuth unit and architecture suites: **19/19 PASS** on Mac ARM64 Node26 using `pnpm --filter @bostan/ui exec vitest run src/features/connections/ConnectionSetupFlow.oauth.test.ts src/features/connections/ConnectionSetupFlow.architecture.test.ts --maxWorkers=1`, no failures or skips.
- `pnpm --filter @bostan/ui typecheck`: official Storybook feature catalog generation (316 files, 2,973 stories) and `tsc -b` passed **exit 0**. A direct `tsc` run without generating catalog JSON initially failed on missing generated Storybook files; rerunning the **official script** resolved the environment prerequisite. No product TypeScript errors were found.
- `pnpm --filter @bostan/ui build`: Vite8/Rolldown production UI **exit 0** (warnings for large chunks only). `git diff --check` passed. No paid inference or external agent calls.

## Still open

This finishes a **scoped first-party connection-page copy repair**, not a full identity or codebase rebrand. More residual legacy names occur elsewhere in the large UI/codebase and may be true external integrations, donor/demo fixtures, compatibility wire IDs, or legitimate third-party notices; they require classification before mutation. Real end-user Windows app, independent full license assessment, real free-model agents and release readiness remain unqualified. **Overall Bostan NO-GO; do not publish.**
