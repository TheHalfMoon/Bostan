# B0-62 — Real OAuth recovery and unsafe URL test expectations honor the privacy contract

**2026-10-27.** Private stacked Draft above B0-61 PR #210 at `a4663ad8d71c8feb88e9cd3c3b36c7f4f97030e0`. No merge to main, publication, deployment, Actions enablement, paid models, or real user data.

## Exact root cause and why this is a test-only correction

B0-61's scoped UI work revealed seven `AppsConnect.test.tsx` failures. To avoid hiding regressions, we checked out the **unmodified B0-60 base** and independently reran all 222 tests: the **same 7 failures were present** (215 pass). Five tests demanded the raw description fragment `sign-in address` for untrusted OAuth authorization URLs. Two other tests demanded the raw provider exception strings `Provider unavailable` and `Response lost`.

The production recovery component deliberately routes these unsafe and potentially credential-bearing exceptions through `safeBostanConnectionOAuthStartError` in `ui/src/lib/bostan-connection-errors.ts`. Its audited default is precisely `Bostan couldn't start secure sign-in. Try again.`, which avoids leaking signed provider URLs, state, codes, tokens or arbitrary exception text. In all five unsafe URL tests the actual `navigateTopLevel` mock **was not called** and the raw hostile URL **was not rendered**. These tests failed only because they were asserting the **obsolete raw-error display contract**. Changing production code to echo raw errors just to satisfy them would have weakened the privacy boundary.

## Scoped fix

Update only `ui/src/pages/apps/AppsConnect.test.tsx`:
- Notion prepared connection and response-lost recovery expect the audited generic error, explicitly verify their injected raw error phrases are **absent**, and still require the real same-connection retry and approved authorization navigation.
- For each unsafe `javascript:`, `data:`, `file:`, plaintext `http:` and credential-in-URL authorization start, preserve negative navigation and raw URL non-disclosure assertions; additionally assert the audited generic Bostan message instead of outdated `/sign-in address/`.

No production behavior, source protocol, redaction policy, mock backend, authorization allowlist or disabled safety path was relaxed.

## Real executed evidence

- `pnpm --filter @bostan/ui exec vitest run src/pages/apps/AppsConnect.test.tsx src/pages/apps/generic-mcp-connect.test.ts src/pages/agent-skills/agent-skill-source.test.ts --maxWorkers=1`: **257 PASS, 0 FAIL, 0 SKIP**, exact code/tests on Mac arm64. Of these, `AppsConnect.test.tsx` now **222/222 PASS** after seven old failures were corrected; added scoped B0-61 cases still pass.
- Independent `pnpm --filter @bostan/ui exec vitest run src/lib/bostan-connection-errors.test.ts --maxWorkers=1`: **16/16 PASS**, verifies audited public and credential-safe error behavior.
- `pnpm --filter @bostan/ui typecheck`: **EXIT 0**, offline-installed dependencies and compiled plugin SDK.
- The B0-61 production Vite UI build already returned **EXIT 0**; this PR modifies **only a test file and this evidence document**, not production bundles.

## Remaining gates

The passing tests cover the named UI recovery scenarios, not a live OAuth authorization against external providers or an independent penetration test. More test harness warnings about unimplemented jsdom `window.open` and undefined mocked query data were observed and do not constitute an end-user browser proof. Native Windows GUI, Linux server/installer, real free-model agent reliability, broader provider matrix, third-party license audit and release qualification remain **OPEN**. Bostan **NO-GO** for publication.
