# B0-61 — Bostan identity across private MCP recovery and skill surfaces

**2026-10-27.** Stacked private Draft above B0-60 PR #209 at `f3028773420b4f262560a55ed6a676d7cce007e9`. Keep repository **PRIVATE**, inherited Actions disabled, no deployment or release, no paid models, and no merge to `main`.

## Actual issue

The compiled Bostan UI still exposed the donor product name in frequently encountered connection error guidance, remote MCP connector consent messages, built-in skill-source labels and the **production** company skill catalog. The shared MCP header error helper also returned a donor-branded message, so changing only a component's fallback text would leave the actual unsafe-header refusal wrong.

## Scoped change

- `ui/src/pages/apps/generic-mcp-connect.ts`: all built-in operator-facing connection/deployment/OAuth diagnostic guidance now says **Bostan**, preserving the remediation code, field focus, redirect URI and protocol behavior.
- `ui/src/features/connections/remote-mcp/RemoteMcpConnectionSetup.tsx`: copy for remote MCP permissions, connection failure, setup and sign-in completion references Bostan.
- `packages/shared/src/mcp-remote-headers.ts`: unsafe/forbidden header refusal now says **Bostan manages...**, with exactly the same header-name and header-value validation and no credential echo.
- `ui/src/pages/CompanySkills.production.tsx` and `ui/src/pages/agent-skills/agent-skill-source.ts`: first-party Bostan-managed/catalog labels and fallback authors now say Bostan. Incoming legacy source badge **`paperclip`**, icon asset identifiers and user-owned custom labels are intentionally retained; predefined donor display labels are mapped to Bostan only when they are exact matches. This does **not** corrupt stored source identifiers or external provenance.
- Updated existing tests for the branded UI, shared header validation and new native skill label mapping.

## Executed verification

- Private UI dependency closure installed **offline** from existing pnpm cache, with ignore-scripts. `pnpm --filter @bostan/plugin-sdk build` and its shared prerequisite succeeded.
- `pnpm --filter @bostan/shared exec vitest run src/mcp-remote-headers.test.ts`: **11/11 PASS**, no skips/fails.
- `pnpm --filter @bostan/ui exec vitest run src/pages/apps/generic-mcp-connect.test.ts src/pages/agent-skills/agent-skill-source.test.ts --maxWorkers=1`: **35/35 PASS**, no skips/fails.
- `pnpm --filter @bostan/ui build`: production Vite build **EXIT 0**.
- `pnpm --filter @bostan/ui typecheck`: final TypeScript build **EXIT 0** after installing the needed offline runner/plugin-sdk dependencies and compiling the plugin-sdk. An initial attempt with an intentionally incomplete filtered dependency set failed with missing `ajv`, `json-schema-to-ts` and `@bostan/plugin-sdk/ui`; that failed attempt is **not** represented as passing.
- **Important existing failure preserved:** the broader `AppsConnect.test.tsx` contains **7 failing cases out of 222**, including two Notion OAuth recovery scenarios and five unsafe authorization URL warning checks, even on the **unmodified B0-60 base**. With B0-61 branding edits and matching test expectations it still has the **same seven failures out of 222**, with all other **215 PASS**. Combined with the 35 targeted passing UI tests, the run is 250 PASS / 7 FAIL of 257. This is **not** a green full integration gate and is not represented as such.

## Boundaries

This is a targeted product-surface branding repair, not a blanket donor-history erase. Preserved versioned protocols, stored sourceBadge values, external provider identities and legally required attribution. The seven pre-existing integration failures require separate real debugging, especially for unsafe OAuth URLs, before qualifying the broader UI. Native installers, free-model governed agent task reliability and independent security/license review also remain **OPEN**. Release **NO-GO**.
