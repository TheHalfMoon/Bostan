# B1-96 — Restore full server TypeScript typecheck after B1-93 Vitest mock typing

Date: 2026-10-31. STRICTLY PRIVATE, ZERO COST, NONPUBLISHING. Exact stacked parent private Draft PR #350 HEAD ab86854935e95214696f1a3443caedeaccf57b55.

## Reproduced parent TypeScript failure

B1-93 introduced a synthetic process-agent onMeta invocation metadata privacy regression in server/src/adapters/process/execute.test.ts. Its mocked callback was defined without arguments, so Vitest inferred mock.calls tuple type [] even though execute() passed a real metadata argument. The test accessed onMeta.mock.calls[0][0] and previously ran successfully in Vitest, but full project TypeScript strict typecheck produced exactly one error: TS2493 at server/src/adapters/process/execute.test.ts(48,56). That error was observed in B1-95 at the exact parent code.

## Exact minimal type-only repair

The callback is now explicitly defined with one parameter (_meta: unknown), matching the actual onMeta callback contract. The same test still verifies the actual metadata passed, rejects secret markers and preserves the real child execution test and no-provider-work-before-spawn acceptance. No production code, agent runtime behavior, provider, sandbox, database or API was changed.

## Executed acceptance evidence

- Native Mac Node26 / Vitest5 focused server process execute and setup suite: **5/5 PASS**, no skips; test-only synthetic and real local Node child paths preserved.
- **Actual full server project TypeScript 7 strict noEmit using project config**: node node_modules/typescript/bin/tsc --project server/tsconfig.json --noEmit, **EXIT 0, ZERO diagnostics**, approx 165 seconds on Mac. This differs from the earlier invalid ad-hoc ES2022 command; the actual ES2023 and project-wide imports were checked.
- No dependencies installed, no external provider, no PostgreSQL, no customer data or cloud spend.
- The source remains scoped to one test callback typing change (plus this evidence). No suppression flags or disabled tests.

## Release remains NO-GO

This is a source-level typecheck repair, not native Windows packed app/Chrome/PostgreSQL qualification, full Linux install validation, untrusted-agent sandbox/effects consent, or complete security/privacy/NOTICE/license/provenance acceptance. Keep PRIVATE and DRAFT. Never merge protected main, publish, deploy, enable GitHub Actions, install paid services or delete unrelated user files.
