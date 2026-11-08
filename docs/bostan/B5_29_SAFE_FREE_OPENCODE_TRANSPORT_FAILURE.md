# B5-29 — Precise transport failure from actual free OpenCode hello test

Private Bostan source only. No public release, main merge, deployment, GitHub Actions, or paid model.

## Grounded failure

A bounded direct native macOS OpenCode CLI test, independent of Bostan's lifecycle, used the currently zero-priced, tool-capable pinned OpenRouter Cohere North Mini Code free model, a volatile credential from the user's existing authorized local OpenCode auth file, and a new disposable HOME/workspace. It invoked the same class of standalone JSON hello request as Bostan's OpenCode environment probe.

The command did NOT successfully respond: it exited with code 130 after the 75-second bounded timeout, emitted 9 step_start events and one error event, and no text event. The error material contained a connection/transport indicator; safe inspection found no clear 429, 401, model-not-found or provider-5xx marker. Raw output, credentials, and provider messages were not printed or committed. The disposable direct CLI test HOME was deleted.

This indicates that a transport failure can be reproduced outside Bostan's lifecycle. It does NOT prove which network hop or provider layer was responsible, does not establish all other model/provider availability, and does not qualify a successful agent.

## Source improvement

Bostan's local OpenCode environment probe now recognizes explicit error-event or stderr signals such as ECONNRESET, ECONNREFUSED, ETIMEDOUT, EAI_AGAIN, ENOTFOUND and network/fetch connection failures from a **failed, explicitly pinned :free OpenRouter model**. It never inspects normal model-generated text to infer the failure. It rejects unsupported model identities and overly long error material.

The new fixed, non-sensitive check is opencode_hello_probe_transport_unavailable. The server harness verifier maps it to harness_probe_transport_unavailable. The lifecycle displays a safe fixed message advising investigation of local network and provider availability. This does not include raw error text, provider output, credentials, URLs, source contents or private paths. Verified free quota/capacity signals retain their precedence, and all other failures remain fail-closed. No fallback to paid models and no bypass of run-attributed source/task/review checks.

## Tests, Mac 2026-10-25

- OpenCode transport/capacity focused tests: 38 PASS (20 new transport + 18 existing capacity).
- Server harness and lifecycle focused tests: 55 PASS.
- Broad Bostan Node source: 128 PASS, 0 FAIL, 9 Windows-specific SKIP.
- OpenCode TypeScript typecheck: PASS.
- No new live inference from these unit tests. Local Alibaba OCR delegate selection is static source/rule eligibility, not an independent AI code review.

## Still unqualified

Real first agent's task Done, exact source comment owned by the successful run, independent second agent's cited review and canonical Case approval remain **OPEN**. The latest Cohere/Flint two-agent attempts both failed before first worker readiness. Windows installed Bostan, model-runtime robustness and cross-platform packaging also remain open. Repository Private, Actions disabled, stacked Draft PR only. Release NO-GO.
