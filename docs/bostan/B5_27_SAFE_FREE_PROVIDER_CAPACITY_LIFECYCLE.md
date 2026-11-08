# B5-27 — Safe, fail-closed free-provider capacity diagnostics

Private Bostan development. No main merge, deployment, public release, GitHub Actions, paid provider or automatic provider fallback.

## The actual B5 blocker

On 2026-10-25 a newly attempted private Mac Bostan/PostgreSQL two-agent source E2E using the live preflight-confirmed zero-price OpenRouter Cohere North Mini Code free model FAILED during the FIRST agent's lifecycle verification. The agent remained paused/verifying with harness_test_failed. The separate reviewer was never reached. The failed private temporary profile was retained and re-opened read-only; the published generic lifecycle error did not expose a reliable specific quota/capacity/auth indicator. It is NOT confirmed that this failure was caused by a provider rate limit.

## Improvement

The original OpenCode environment hello-probe paths could return a generic opencode_hello_probe_failed result even when the failing free provider clearly reported HTTP 429, RateLimitError, TooManyRequests, quota exhaustion or explicit provider capacity. Under an exact pinned OpenRouter provider/model:free identity AND failed hello probe, the new pure classifier now emits a fixed check code opencode_free_provider_capacity_unavailable. No raw provider output, secret, URL, message, user data or executable detail is copied into that check.

The harness verification layer maps this new fixed code and the existing opencode_free_usage_limit_reached to harness_free_provider_limited. The lifecycle uses an entirely fixed description: free provider limited/capacity, no paid fallback, retry when free capacity is available. The disposable source QA only emits the narrow fixed code when its API actually reports that fixed lifecycle message. Generic provider/CLI/auth/model/test errors remain generic or use their already qualified specific reason; no speculative cause is inferred.

## Tests and limitations

- OpenCode adapter real source tests with mocked remote environment: 31 PASS, 0 FAIL (13 existing, 18 new).
- Server harness and lifecycle diagnostic unit tests: 51 PASS, 0 FAIL.
- Bostan Node source regression: 127 PASS, 0 FAIL, 9 Windows-specific SKIP.
- OpenCode adapter TypeScript typecheck: PASS.
- All new unit tests are local, with no provider inference. Alibaba OCR local delegate eligibility/rule selection is not independent AI code review.
- The last real B5 first-agent lifecycle remains FAILED, not a B5 two-agent success. Run-owned first-agent Done, correct source comment, independent reviewer citation, Case approval and cross-platform installed acceptance remain open.

Repository PRIVATE, inherited Actions disabled, Draft/unmerged only. Release NO-GO.
