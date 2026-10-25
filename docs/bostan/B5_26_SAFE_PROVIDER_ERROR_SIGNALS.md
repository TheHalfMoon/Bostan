# B5-26 — Safe adapter rate-limit and outage diagnostic signals

Private, draft-only Bostan development. No main merge, publishing, deployment, Actions or paid model/provider.

## Actual problem

Previous B5-25 private disposable OpenRouter/Cohere + Bostan/Postgres two-agent QA returned generic adapter_failed at dispatching. A stopped-profile authenticated diagnostic readback found rate-limit and timeout/provider-outage indicators in adapter error/output material. This is not proof that every failure originated from the free provider, but establishes why the raw generic adapter_failed code is insufficient.

## Scoped improvement

A pure source-QA-only function named safeFreeProviderFailureSignal examines error fields only for already-failed adapter_failed heartbeats, and emits one of three fixed codes for rate-limits, provider unavailability or timeout. The synthetic failure message includes only the fixed code, status, stage and prior safe errorCode. No raw provider output, credentials or user text leave this boundary, and failed runs can never pass the original heartbeat, stored source-comment/run, or B5/B4 canonical verifier gates.

## Tests and limits

113 Bostan source Node tests passed on Mac; 9 platform-specific tests were skipped. Alibaba Open Code Review delegation mode performed local static source selection and rule lookup, not LLM-based review. No new free/paid model invocation was made on B5-26 after observing rate-limiting signals.

First-model real task Done and second independent reviewer with true source/run citation are not yet qualified. B4 knowledge/OCR/analytics, B5 native model-driven canonical case approval, B6 installers, Windows/Chromium and independent security remain OPEN. Release NO-GO.
