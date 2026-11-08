# B5-22 — Identify free OpenCode capacity exhaustion without buying a model

## Reproduced cause of the blocked real B5-20/B5-21 evaluation

The actual standalone OpenCode testEnvironment error detail, read only from the disposable test configuration, said "Free usage limit reached." The provider offered paid access. No subscription or payment was authorized, no credentials changed, no real project data was used, and no paid provider was retried. The model replied in earlier free tests; present free allowance has been exhausted.

The adapter previously recognized "free usage exceeded" as an authentication issue, but did not recognize "Free usage limit reached", classifying it as a generic opencode_hello_probe_failed. This hid the real reason the agent failed lifecycle admission on B5-20/B5-21.

## Narrow change

Introduce opencode_free_usage_limit_reached as a typed **error-level** environment-test check. It matches free-usage-limit and free-tier-quota exhaustion responses before generic authentication/model errors without reproducing untrusted advertising or private context in its message. This does not relax readiness, disable checks, treat the exhausted model as usable, automatically switch models, bypass limits or activate paid usage.

An unsupported B5-22 provider-model-override experiment was reverted after it failed a real isolated probe. Only observed capacity diagnostics remain.

## Verification

- 35/35 focused adapter environment/model/standalone tests **PASS** across three suites.
- Adapter TypeScript typecheck **PASS**.
- Actual provider capacity diagnosis **confirmed**, but full two-worker run-ID-cited review **unqualified** until free access returns. No new live pass claimed.
- Prior B5-19 real cross-agent citation passed; B5-20 new run-ID proof is still unit-qualified but not real-provider-qualified.

## Open work

When free access returns, rerun the private bounded acceptance with existing explicit free opt-ins. Never spend money to manufacture a test pass. Full native signed-JWT independent verifier with B4 source HMAC and canonical Case Done, B4 analytics/OCR, Windows/Chromium, B6 packaging, external effects and security qualification remain uncompleted.

**Private development draft only; no merge, publication, deployment or release. NO-GO.**
