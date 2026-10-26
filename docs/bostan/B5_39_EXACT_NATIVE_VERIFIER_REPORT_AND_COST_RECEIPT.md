# B5-39 — Exact reviewer-run/report provenance and explicit zero-cost evidence

Private Bostan development, 26 October 2026. Draft stacked on B5-38 / PR #151. No merges to main, publishing, deployment, provider charges, GitHub Actions or removal of mandatory source licensing.

## Actual QA acceptance gap

The native model-led governed Case QA was requiring distinct specialist/verifier agents, successful runs, a separate JSON report, a board summary marked current, and no nonzero costs. Its final pass condition could still combine a successful later reviewer run with a DIFFERENT earlier verified report on that same Case, because it verified only reviewer agent ID, not the board's actual reviewRunId or reportDocumentId.

It could also declare Case success with missing/unknown usage costs: free-listed model names never prove a measured zero-dollar receipt. These are TEST false positives, not evidence that the production Case authorization or signed PostgreSQL source guard was bypassed.

## Fail-closed completion receipt

After original Case Done, require:
- Exact board summary schema bostan.verification.board-summary.v1, same original Case ID and confirmed board-side Case status Done
- Board current=true and provenanceCurrent=true
- Exact reviewer agent ID AND exact reviewer run ID from the persisted successful reviewer heartbeat
- Exact board reportDocumentId equals task's separately persisted JSON report ID (not the source ID)
- Exactly one current cited source, explicitly untrusted with factualRelevanceVerified=false and executionAuthorized=false
- Both specialist and verifier persisted usageJson.costUsd must be numeric zero. Missing/unknown/text/positive/negative/null telemetry fails closed.

Only then may the harness emit BOSTAN_REAL_FREE_GOVERNED_CASE_PASS.

## Verified and limitations

- Nine focused native Case receipt/admission tests pass, including adversarial switched reviewer run, switched report ID, changed Case and missing/nonzero model-cost probes.
- Broad Mac and Windows source tests and canonical PG integration are recorded separately upon exact-head verification.
- Zero in Bostan persisted cost telemetry does not establish an independently verified provider invoice; payment reconciliation would be an additional gate for live external use.
- No actual model-led reviewer report qualified on current 8GiB Mac, where B5-35 host preflight still blocks full native Case QA. Official entire-server typecheck/build, installed Windows app and external security review remain unqualified. Release NO-GO.

## Verified on B5-39 head

- Native Mac source Bostan Node suite: 164 PASS, 0 FAIL, 9 platform-specific SKIP (173 total).
- Native Windows Abdulaziz source Bostan Node suite: 166 PASS, 0 FAIL, 7 platform-specific SKIP (173 total).
- Five canonical independent Case/JWT/HTTP/native verifier/PostgreSQL integration files: 22 PASS, 0 FAIL.
- Disposable macOS source Bostan HTTP/Postgres persistence with clean stop/restart and real headless Chromium private UI: PASS, browser page errors 0, external requests blocked 0, clean stop.
- No new free-model native inference was attempted on the under-resourced Mac; it correctly remains blocked by the QA-only B5-35 resource gate.
