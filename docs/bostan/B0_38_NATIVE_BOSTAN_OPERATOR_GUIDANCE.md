# B0-38 — Native Bostan operator guidance for allowed hosts, exports and setup

2026-10-27. Private stacked Draft above B0-37; no publication, deployment, `main` merge, paid model, inherited Actions activation or persisted-schema rewrites.

## Findings from product-surface review

Multiple user-facing runtime/help surfaces still suggested unsupported public donor CLI commands (`npx paperclipai allowed-hostname`, `npx paperclipai company import`, `npx paperclipai run`, `npx paperclipai board setup`) while the actual private `bostan` CLI preview intentionally disables those commands. Blind replacement with similarly unsupported `npx bostan ...` would mislead users and could fetch an unrelated package from the public registry.

## Changes

- Added a **native Bostan configuration alias**: `BOSTAN_ALLOWED_HOSTNAMES` takes precedence when set, with read-time fallback to the legacy `PAPERCLIP_ALLOWED_HOSTNAMES` environment variable for compatibility. No persisted config or database schema was renamed.
- Updated hostname-guard error text, the access-route diagnostic and onboarding text, and agent onboarding prompts to tell operators to configure the supported `BOSTAN_ALLOWED_HOSTNAMES=<host>` server environment setting and restart. These messages use a **static `<host>` placeholder**, never interpolate a potentially hostile `Host` header into shell advice.
- Corrected the client connection-error guidance to mention the actual source-only `bostan app run --local` CLI preview rather than disabled public donor commands.
- Rebranded generated company-export README footer/link to Bostan; referenced the supported `bostan company inspect <local-export.zip>` command instead of advertising disabled import.
- Removed the unavailable public donor board-setup CLI from the operator-facing board skill, retaining its historical `PAPERCLIP_API_URL` environment-variable name as a compatibility key until an audited API migration.
- Updated CLI safety tests and hostname-guard expectations to enforce the *supported private Bostan behavior*, not phantom public npm commands. Added coverage for native configuration precedence and fallback.

## Evidence

- Targeted Vitest tests including Bostan allowed hostname precedence/fallback, blocked hostile Host header remediation, CLI invocation safety and startup identity: **49/49 PASS**.
- Source diff passes `git diff --check`; no SQL migrations, legal notices, public registry artifacts, or inherited release state altered.
- Mac PostgreSQL + server HTTP integration from B0-36/B0-37 remains previous evidence, not claimed to be rerun specifically with this configuration alias.

## Unqualified

This focused copy-first operator-help remediation is not an exhaustive sweep of historic source paths, legal notices, schema/wire protocol names or old release-workflow templates. Full native Rust/installed multi-OS E2E, real existing data upgrade, authenticated user workflow, release qualification and independent security review remain open. **Release NO-GO.**
