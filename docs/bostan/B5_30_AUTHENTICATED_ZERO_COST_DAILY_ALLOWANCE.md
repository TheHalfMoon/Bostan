# B5-30 — Authenticated OpenRouter daily allowance gate before free-only source QA

Private Bostan source work. No main merge, public release, deployment, inherited GitHub Actions or paid provider.

## Real failure investigation — 2026-10-25

Two true zero-price OpenRouter source E2E tests (Cohere North Mini Code and Recursive Flint) failed before the first worker completed its synthetic task. Bounded native OpenCode CLI hello also failed with a connection indicator, including when the hello prompt was passed as a positional CLI argument. The hypothesis that passing stdin instead of argv was solely responsible was therefore NOT confirmed.

Read-only and bounded direct live provider evidence:

- One zero-price-prefighted direct free-model POST returned HTTP 429 with a rate-limit class, not a successful completion.
- Separately, the user's existing authorized and explicitly opted-in OpenRouter key was used for a non-inference GET https://openrouter.ai/api/v1/key . It returned HTTP 200 with daily free-model counters used **60**, limit **50**, remaining **0**. The key, account identity and raw error were never printed.
- After the code change, a real free-model preflight rejected quota 0 with the fixed safe message: OpenRouter free-model daily allowance exhausted; no inference started. No inference request or disposable Bostan app/database was started. PASS.

This independently explains why the direct model request was rate-limited, although it does not prove that every preceding OpenCode network failure had exactly the same cause. OpenRouter's public limit documentation is https://openrouter.ai/docs/api-reference/limits . No further retries, paid models, new accounts, purchased credits or quota workarounds are authorized.

## Implemented

The previous free model preflight established exact zero prompt/completion/request price and tools support from the public catalog. It did not establish that the key had any daily free requests left.

The new source-only preflight keeps all catalog, credentials, opt-in and allowlist checks, and adds a separate authenticated read-only GET /api/v1/key quota check before passing the transient credential back to the caller.

- Daily free-model counters must be exact safe nonnegative integers: used, limit, remaining. Limit must be positive and remaining cannot exceed limit.
- Quota 0, unavailable/malformed metadata, non-200 response and network errors fail closed BEFORE allocating a synthetic source app/Postgres profile or invoking OpenCode.
- Errors contain only fixed strings. The private key/account metadata and raw provider responses are not emitted.
- Catalog still receives NO Authorization header. The key endpoint receives the key only in Authorization, as required by the official API.
- A positive daily remaining count does NOT prove per-minute or upstream availability and is not a license to retry aggressively. No paid fallback.

## Mac test evidence

- Focused source/lifecycle/daily quota tests: 27 PASS.
- Broad Bostan Node source tests: 132 PASS, 0 FAIL, 9 Windows-specific SKIP.
- Authenticated live GET-only quota preflight: exact quota-exhaustion refusal, 0 inference attempts, PASS.
- No changes to the installed user Bostan profile or real records.

## Open gates

A separate FULL server TypeScript command on an 8-GiB RAM Mac was killed by SIGKILL (~87 seconds, high memory). That is a resource/qualification blocker, NOT a typecheck pass or an established source-code type error. Do not repeat the unbounded compiler on this Mac unchanged. Other recent UI typechecks, PostgreSQL/HTTP and Chromium tests passed, but do not qualify the full server compiler.

Real first-agent task Done, exact run-owned persisted comment, independent second reviewer and Case approval remain OPEN until a true model run succeeds. Windows full installed Bostan/installer and independent security qualification are also OPEN.

Repository PRIVATE, Actions disabled, Draft PR unmerged. **Release NO-GO.**
