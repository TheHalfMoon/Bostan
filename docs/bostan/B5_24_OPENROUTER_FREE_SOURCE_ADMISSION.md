# B5-24 — OpenRouter zero-price free-agent admission, isolated Bostan source runtime

**Private source development. No main merge, deployment, publishing, release, paid API/model or Actions.**

## Trigger and verified free route

The prior source-only OpenCode free provider returned "Free usage limit reached"; this is a provider quota, not Alibaba local code-review demand. OpenRouter's public live model catalog on 2026-10-25 returned exactly zero prompt and completion prices and tool capability for:

- openrouter/cohere/north-mini-code:free
- openrouter/recursive/flint-v1.0:free

A native macOS OpenCode installation has an existing OpenRouter API credential. The credential was never printed, copied to ChatGPT, committed, or changed. A single direct OpenRouter HTTP chat-completions request to Flint returned HTTP 200 with actual message content. Separate isolated native OpenCode CLI calls to Cohere and Flint returned exit code 0 with actual text event. The Cohere response was substantively correct but not byte-identical to the requested marker (it added punctuation), so no exact-response qualification is claimed from those probes.

Most importantly, a direct real OpenCode adapter testEnvironment invocation against the pinned Cohere zero-price model, with isolated HOME and volatile OpenRouter env credential, returned **PASS** with opencode_hello_probe_passed.

## Bostan integration and actual root cause

The isolated Bostan source launcher deliberately strips all inherited AI provider keys when it launches the backend server. That correct normal privacy boundary also discarded OPENROUTER_API_KEY from the explicit opt-in disposable source QA, so a full source app's first agent failed lifecycle verification even though the direct adapter had already passed.

B5-24 adds one narrow, guard-checked exception only when ALL of these hold:

- Explicit BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 and BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E=1 and BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL=1.
- Existing owned temporary HOME (not installed/user HOME), exact pinned OpenRouter free test slug.
- Public OpenRouter catalog just independently verified exact zero prompt and completion (and zero request cost if present) and support for tools.
- Exact verified preflight marker, valid OpenRouter key in the memory-only source QA process.

The backend then receives only OPENROUTER_API_KEY and PAPERCLIP_OPENCODE_SMALL_MODEL pinned to that exact free slug. All other secrets, telemetry, remote provider keys, site settings and external inherited configuration remain blocked by the original privacy filter. The ordinary installed app path never inherits them. No credentials are persisted to the disposable profile. The user must explicitly set BOSTAN_E2E_USE_SAVED_OPENROUTER_AUTH=1 to allow a read-only lookup of their existing local OpenCode credential when an env key was not supplied. Unsafe/symlinked/foreign-owned auth file is rejected; no key is logged.

The adapter's source-only standalone probe accepts only those two new pinned :free slugs in addition to the original OpenCode free-test slugs. All other models and ordinary adapters retain the original validation path.

## Executed tests and honest live boundary

- 51/51 Node focused preflight, key-isolation, worker provenance and synthetic E2E guards PASS.
- 35/35 OpenCode adapter focused Vitest PASS; adapter TypeScript PASS.
- Real OpenRouter zero-price API inference HTTP 200, real native OpenCode standalone completion PASS, and **real adapter hello PASS** against OpenRouter.
- Full live private Bostan/PostgreSQL run with two-agent/review flags on Cohere **FAILED** after lifecycle entry. Independent SQL/API readback from the retained stopped synthetic test profile showed first issue in_progress, one actual agent-authored **run-attributed** persisted comment, but NO success marker; therefore first worker was not qualified and second was not tested.
- Full live source run on Flint **FAILED** with first heartbeat status failed, errorCode adapter_failed, executionStage dispatching. No model-driven successful first or independent reviewer was qualified from this.
- Both unsuccessful model trials were limited to ephemeral source QA without real customer tasks or external business effects. Bostan's free-model E2E fail-closed acceptance was NOT relaxed, and no paid model or credit upgrade was used. The stopped disposable failure profiles are deliberately retained only for debugging, not considered successful assets.

## Command for a bounded, explicit future retry when source compatibility improves

On a Mac with an existing authorized OpenRouter key stored in native OpenCode, with no existing production tasks:

BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E=1 BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL=1 BOSTAN_E2E_USE_SAVED_OPENROUTER_AUTH=1 BOSTAN_E2E_TWO_AGENT_TEAM=1 BOSTAN_E2E_REVIEW_FIRST_AGENT=1 BOSTAN_E2E_FREE_MODEL=openrouter/cohere/north-mini-code:free node scripts/bostan-local-live-persistence-e2e.mjs

The source process rechecks actual zero prices before creating test state; a changed/paid model fails closed. The free OpenRouter account's provider rate limits apply. Never retry by selecting a paid model or bypassing the existing source-HMAC/native signed-review gate.

## Release

Native correct model-mediated task completion and verifier reasoning, fully qualified cross-agent run-ID citation, source B4 analytics/OCR, B6 packaging, Windows E2E and independent security audit remain **OPEN**. Release **NO-GO**.
