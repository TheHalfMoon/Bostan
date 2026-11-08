# B4-07 — Real private Bostan task-browser OCR preview

Private source development. No release, deployment, main merge, GitHub Actions, paid model, cloud inference or actual user data.

## User-facing feature

B4-06 provided read-only local Tesseract PNG/JPEG OCR with English and Arabic language support. B4-07 adds BostanOcrPreview in the classic task Documents section, modern task body and optional Artifacts tab. The UI build requires VITE_BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1; the private server also requires BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1. Default: off. A file is checked as PNG/JPEG at <=256 KiB before reading; its base64 is sent to the same-origin Bostan API and never to a remote model. Language may be eng, ara, eng+ara. The extracted text is shown in a read-only textarea without HTML interpretation or any auto-document create/update. Closing or unmounting aborts ongoing requests.

The component requires the server to affirm untrusted source, false provenance, false factual relevance, false decision authority, no saved document and no authorized action. Unsafe responses are refused.

## Actual Bostan source integration defect repaired

Bostan's isolated application child process deliberately does not inherit arbitrary environment variables or model provider keys. It was accidentally dropping the B4-06 OCR enable flag: the real server returned HTTP 404, even though the parent was started with the feature explicitly enabled. Only the literal BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1 is now forwarded to the private child; other values are rejected and provider secrets stay isolated. Added explicit negative tests.

The synthetic browser E2E creates an actual company and task inside a fresh, disposable Bostan/PostgreSQL HOME, restarts the server, opens the true task React route in Chromium, selects a synthetic Arabic PNG, verifies recognized Arabic in the rendered textbox, and verifies the real task document list was not modified. Fixed a separate acceptance race where immediate DOMContentLoaded element counts were mistaken for lazy React hydration. No installed application/user browser is touched.

## Evidence — Mac, 2026-10-25

- Full private app + PostgreSQL restart + headless Chromium OCR UI workflow: BOSTAN_LOCAL_PERSISTENCE_E2E_PASS, exit 0, including real-browser-bilingual-ocr-no-document-write and clean stop. JavaScript errors 0; attempted external HTTP requests 0.
- UI production Vite build with explicit OCR feature flag: PASS.
- Bostan Node source regression: 125 PASS, 0 FAIL, 9 Windows-only SKIP (134 total).
- UI TypeScript typecheck: PASS.
- Focused UI Vitest (OCR panel + existing document section): 15/15 PASS. Some jsdom React act warnings are nonfatal.
- B4-06 native Tesseract/HTTP/PostgreSQL ACLs: 9/9 PASS (prior wave); B4-06 wider B4 citation/decision regression 43/43 PASS (prior wave before concurrency-only edit).
- Alibaba OCR delegate preview is static-rule file eligibility selection, not independent model-based code review.
- No paid inference, no user data, no claim of full server typecheck or Windows installed app qualification.

## Opted-in disposable QA

Build: VITE_BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1 pnpm --filter @paperclipai/ui build

Run: BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 BOSTAN_LIVE_LOCAL_BROWSER_E2E=1 BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E=1 BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1 node scripts/bostan-local-live-persistence-e2e.mjs

## Outstanding release gates

Windows native installed UI, bundled Tesseract, PDF/image breadth, document review/save UX, measured OCR accuracy, complete B4 analytics, independent B5 real free-model multi-agent verifier acceptance, full server TypeScript, security audit and final package qualification are still OPEN. Repository Private; Actions disabled; this PR Draft stacked and unmerged. Release NO-GO.
