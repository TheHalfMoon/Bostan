# B6-25 — Full private browser matrix and compile-time OCR admission

Private Bostan development, 26 October 2026. No release, deployment, public repo, main merge, Actions, paid model or real customer data.

## Actual integration finding

An expanded real Chromium QA pass combining new-company onboarding, first paused agent, adapter selection, dashboard analytics, source route lazy loading, HTML referrer safety and local Arabic OCR initially FAILED waiting for an Artifacts tab. This was not a Case or OCR inference failure: the source UI was compiled without the Vite compile-time OCR flag, even though the test runtime set BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1. The runtime flag alone cannot resurrect a compile-time-disabled React control.

The genuine source browser QA passed immediately after rebuilding the same unchanged UI source with:

VITE_BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1 pnpm --filter @paperclipai/ui build

The B6-25 guard now checks the built route-scoped IssueDetail JS for the opt-in OCR controls **before creating a disposable PostgreSQL profile or opening Chromium** when the explicit OCR browser test is requested. It refuses missing, duplicate, broken, symlinked or flag-disabled built chunks rather than returning a misleading browser timeout. The regular non-OCR source/build behavior is unchanged. A synthetic test covers positive, disabled, duplicated and broken-link cases.

## Verified real browser journeys

Using only a disposable localhost app+PostgreSQL and real headless Chromium:
- New-company onboarding and paused/inactive first agent creation
- Selecting a local adapter while worker remains paused; no provider inference
- Company dashboard task-insights rendering
- Static HTML and OAuth fallback privacy headers and redaction
- Route-scoped lazy IssueDetail JS download
- Private Arabic OCR preview of synthetic picture with no automatic task-document writes
- Additional large synthetic Arabic image processing to bounded local JPEG, <=256 KiB before POST
- Real PostgreSQL clean stop/restart and persisted company readback

**PASS, exit 0**, browser page errors = 0, external blocked requests = 0, clean stop. The OCR route remains local, no real uploads or remote image processors.

## Reproducible no-cost opt-in

Build the UI first with VITE_BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1. Then run the existing scripts/bostan-local-live-persistence-e2e.mjs with these environment flags set to 1:

BOSTAN_LIVE_LOCAL_QA_CONFIRM
BOSTAN_LIVE_LOCAL_BROWSER_E2E
BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E
BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E
BOSTAN_LIVE_LOCAL_BROWSER_ADAPTER_SELECTION_E2E
BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E
BOSTAN_LIVE_LOCAL_BROWSER_HTML_HEADERS_E2E
BOSTAN_LIVE_LOCAL_BROWSER_INSIGHTS_E2E
BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E
BOSTAN_LIVE_LOCAL_BROWSER_LARGE_OCR_E2E
BOSTAN_LOCAL_OCR_PREVIEW_ENABLE

The guard protects correctness, not broad release qualification. It does not claim Windows installer E2E, full server TypeScript/build, real independent model-authored Case verdict or comprehensive external security signoff. Release NO-GO.
