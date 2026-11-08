# B0-37 — Bostan startup wordmark and valid private-CLI guidance

2026-10-27. Private, stacked Draft PR above B0-36; no `main` merge, deployment, release, paid inference or inherited GitHub Actions enablement.

## Issue found in a real local server run

Despite all workspace package npm names having native Bostan identities, the **actual user-visible server startup banner** still rendered the upstream six-line donor ASCII wordmark and advertised `npx paperclipai onboard` when Agent JWT was unset. This was not an acceptable Bostan runtime identity. The Bostan private CLI preview does *not* implement `onboard` or a published `npx bostan onboard` command; an in-place renaming of this advice would be nonfunctional and unsafe.

## Fix

Replaced the terminal wordmark with a concise lowercase `bostan` identity and replaced the unsupported CLI suggestion with `missing (configure Bostan agent JWT for this instance)`. Preserved versioned `PAPERCLIP_AGENT_JWT_SECRET` configuration semantics, DB schemas and wire identifiers, secret redaction, existing row/table content, auth readiness logic and upstream legal/license notices. Updated the one outdated CLI safety expectation to require a private Bostan-compatible banner, and corrected two unrelated pre-existing assertions that assumed public donor CLI commands were still supported by the Bostan private preview. The company-export UI's actual supported guidance is `bostan company inspect <local-export.zip>`; the first-admin fallback notice explicitly states that the private CLI does not support bootstrap. These safety tests now enforce supported behavior rather than resurrecting disabled npm commands.

Strengthened `scripts/bostan-local-http-postgres-smoke.sh` to verify that the **booted** server log contains the Bostan wordmark and never contains the unsupported `npx paperclipai onboard` command.

## Verified

- Real localhost PostgreSQL 17.9 + actual `@bostan/db migrate` + real `node --import tsx src/index.ts`: **PASS**; `/api/health` HTTP 200, `local_trusted`, private exposure, `authReady=true`, `bootstrapStatus=ready`.
- Boot log identity check: **BOSTAN_BOOT_BANNER_QUALIFIED**; disposable server/DB stopped and removed afterward.
- Vitest `bostan-startup-banner-identity.test.ts` plus full inherited `cli-invocation-safety.test.ts`: **41/41 PASS**.
- No actual agent secret, paid model or cloud service invoked; inherited legal provenance retained.

## Remaining gaps

Some unrelated compatibility/help surfaces and inherited tests still mention historical donor CLI commands (for example older public-release workflows and board-setup documentation). They require separate contract-led changes, not search-and-replace of persisted data or invented Bostan CLI capabilities. Installed Windows and other OS E2E, native Rust build/qualification, real user migration and security signoff remain OPEN. **Release NO-GO.**
