# B6-22 — AWS provider error diagnostics must not trust backend detail strings

Private Bostan work stacked on B6-21 PR #141. No main merge, distribution, deployment, paid provider or customer credential use. Mandatory attribution stays intact.

## Risk and correction

The secret-create and AWS discovery diagnostic components displayed raw ApiError.message plus fields supplied under error.details, such as actionableMessage, safeAlternative, credentialPath, providerConfigId, region and requiredCapability. Labels like "Safe request/error details" did not make those provider strings safe; the Copy button could also reproduce them.

The UI now:
- uses fixed retry copy instead of Error.message, including the adjacent agent secret-access error message;
- uses exact built-in AWS CreateSecret / ListSecrets guidance for recognized access_denied classification;
- composes copied JSON only from local constants, numeric response status, a validated form region, a strictly-validated AWS region and a local vault identifier;
- ignores backend-provided actionableMessage, safeAlternative, credentialPath, provider vault context, required capability and unrecognized codes;
- avoids printing backend provider/operation classifications as verbatim labels;
- preserves error state, structured code classification, manual AWS region edits, retry and real API behavior.

## Verification on macOS

- React Secrets suite: 32 PASS, 0 FAIL (including expanded synthetic secret injection into multiple supposedly-safe provider diagnostic fields).
- Full UI TypeScript tsc -b: PASS.
- Real production Vite UI build: PASS; existing large bundle warnings.
- Broad Bostan Node source tests: 149 PASS, 0 FAIL, 9 Windows-only SKIP (158 total).
- No live AWS requests or real credentials used.

## Open gates

This is a scoped diagnostic privacy fix, not an all-screen security clearance. Error disclosure in other screens and provider health responses needs further audit. Genuine first agent and independent second-model reviewer Case, full official server build/typecheck, installed Windows app and independent security acceptance remain open. Release NO-GO.
