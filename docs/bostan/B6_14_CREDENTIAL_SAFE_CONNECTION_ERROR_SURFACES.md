# B6-14 — Credential-safe OAuth and Grok Bot connection errors

Private Bostan source work. Do not merge main, publish, deploy, enable inherited GitHub Actions, use paid inference or alter any actual user/provider credentials.

## Actual security defect

The OAuth callback landing was echoing a raw caught Error.message into the browser when provider navigation failed. The Grok Bot connection panel rendered any upstream/query/mutation Error.message. These untrusted messages can contain OAuth authorization codes or state, signed URLs, webhook keys, provider error payloads and private URLs. HTML text escaping does not protect those secrets from being visibly disclosed or captured by a screenshot.

B6-14 introduces a tiny pure UI error-admission module:
- Managed OAuth state renders only one of three known, exact Bostan/local error messages plus the already locally emitted short "This sign-in expired. Start the connection again." variant. Unknown strings, Error objects, URL/code/state text and provider diagnostics become "Bostan couldn't prepare secure sign-in. Try again."
- OAuth callback catch passes exception text only through the **exact allowlist**, never directly to the React view. Expected local expired-session cases remain actionable; reauthentication uses the existing fixed Bostan message. Retry/cancel behavior, navigation and pending handoff storage are unchanged.
- The Grok Bot panel's upstream network/mutation errors always render a fixed safe Bostan connection error. It never interpolates the provider's raw Error.message into JSX.
- All other connection status/authorization semantics and key handling remain unchanged. No credential is printed, stored, regenerated or passed to a new service.

## Qualification, Mac, 2026-10-25

- Three new focused security suites: **14 PASS**. This includes real React rendering tests for OAuth callback failure and Grok Bot query rejection containing synthetic secrets and URLs, plus pure unit cases for exact message admission.
- Including the existing managed OAuth callback and handoff tests: **23 PASS across five UI suites**.
- UI TypeScript check: **PASS**.
- Actual production UI Vite build: **PASS**. Existing large chunk-size advisory remains; no claim of performance qualification.
- Broad Bostan Node source suite: **135 PASS, 0 FAIL, 9 Windows-specific SKIP** (144 cases).
- Pre-existing OAuth UI test copy was stale after B6-13 rebranding. Updated that test to expect Bostan, preserved existing local expired-session message without permitting arbitrary errors. The first added Grok test needed to wait for the query's React state update; after test harness correction all suites passed.
- No real external OAuth/Grok authorization was attempted, so this is UI-level security qualification, not a completed end-to-end third-party connector approval.
- Local Alibaba OCR delegate selection, if run, is static-rule source eligibility, not independent AI review.

## Remaining release blockers

B5 successful true free-model first-agent task, exact run-authored comment, independent second reviewer and Case; full server TypeScript on a higher-memory machine; native Windows installed app and bundle; complete security review and release packaging remain **OPEN**. Repository PRIVATE, Actions disabled, Draft PR unmerged. **Release NO-GO.**
