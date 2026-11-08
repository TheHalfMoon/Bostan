# B1-95 — Redact Copilot and ACPX setup errors without losing verdict codes

Date: 2026-10-31. Strict PRIVATE, zero cost, nonpublishing. Exact stacked parent Draft #349 head 3a47c612745d81358066b54ffcf6562e541cf013.

## RED-before-GREEN security proof

The production server/src/adapters/registry.ts copied arbitrary HttpError.message from classified failed Copilot metadata probes into user-visible paperclip_runner environment checks. It also copied arbitrary Error.message from ACPX runtime package/probe errors. External errors may contain provider account tokens, filesystem paths and credentials. Unexpected non-HttpError Copilot failures were already sanitized, but classified HttpErrors were not.

Two synthetic no-network regressions were added to server/src/__tests__/adapter-registry.test.ts before code changes: one for classified COPILOT_ENTITLEMENT_DENIED HttpError with a private marker and one for a Claude ACPX error containing private markers. Exactly 2/2 tests RED on the parent, proving external error strings appeared in setup results. No real tokens, provider prompts, database or remote effects.

## Minimal production fix

Copilot failures retain their existing allowlisted COPILOT_* failure codes, while their message is fixed to "Copilot metadata verification failed." Distinguishing authorization, entitlement, model, installation, and request errors remains possible through the code. ACPX runtime failures preserve acpx_runtime_package_missing / acpx_runtime_unavailable codes and use "The ACPX runtime could not be verified." No raw external exceptions are copied. Actual probe execution, token source, model selection, package installation, authentication, runner execution and cost checks are unchanged.

Mac Node 26/Vitest 5, one worker, 1280MiB: 65/65 PASS, zero skips (35 registry and 30 routes cases), including both original RED regressions. git diff --check PASS.

## TypeScript gate transparency

An ad-hoc TS7 command using ES2022 caused unrelated source errors since the actual project targets ES2023. Retried with the actual server/tsconfig.json: full TS typecheck completed EXIT 1, exactly one existing parent-branch test-file diagnostic outside this PR diff: server/src/adapters/process/execute.test.ts(48,56): TS2493. The existing mocked callback is inferred as a zero-argument tuple but the test accesses mock.calls[0][0]. The B1-95 source changes do not touch that file. Full server TypeScript must NOT be reported PASS; its pre-existing problem requires an independent repair.

## Still NO-GO

This closes only a concrete setup diagnostic leakage class, not full sandbox and consent for untrusted agent actions. Windows packed HTTP/Chromium/PostgreSQL, native Linux, installers, multitenancy/load, complete security/privacy/licensing/NOTICE/provenance remain release NO-GO. Repo PRIVATE, DRAFT PR, no protected main merge, paid models, customer data, GitHub Actions enablement, release or deployment.
