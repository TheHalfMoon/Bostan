# B4-06 — Offline Arabic/English image OCR preview with scoped task authorization

**Private Bostan source development; no main merge, paid model, publication, deployment or enabled GitHub Actions.**

## Why this exists

B4-01 through B4-05 already protect task/document version provenance, current signed citations, final board decision freshness and current human reviewer read access. Those controls are not OCR: a scanned image cannot supply text to a verified document without an actual local extraction step.

B4-06 adds a separately enabled, read-only **OCR Preview** to the original company-and-issue-scoped Bostan evidence API. It uses **Tesseract 5.5.2** (already available locally on the authorized Mac) rather than cloud models. No new AI account, provider token, paid infrastructure, GPU, dataset download or background service is created.

## The scoped route

POST /api/companies/{companyId}/issues/{issueId}/bostan-evidence/ocr-preview

Body: exactly mimeType, base64 and language, where mimeType is image/png or image/jpeg and language is eng, ara or eng+ara. Raw binary size <= 256 KiB. The route is disabled by default and can be explicitly enabled on a private local instance with BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1.

The existing Bostan board/company auth is reused before any OCR process. Current live company:read authorization, company/task identifiers, canonical issue read privacy SQL, hidden task and harness-kind exclusions are checked. Cross-company actors, agents, inaccessible issues and malformed requests fail before image processing. No new writer, task, document, ledger, HMAC, model agent, retry workflow or decision authority is created.

The local OCR service:
- Verifies canonical base64, maximum length, approved image MIME and PNG/JPEG magic signature before temporary file creation.
- Writes only an unpredictable temporary input file in the OS TEMP folder with mode 0600 inside a private mkdtemp folder, then deletes it in every success/error path.
- Invokes an absolute installed local Tesseract binary via execFile without a shell, only predefined language flags and bounded psm setting. No cloud or arbitrary user-supplied command path.
- Bounds Tesseract execution to 15 seconds, output buffer to 64 KiB, response text to 2,000 characters and total concurrent OCR processes to two. Further requests fail as HTTP 429, with no queue accumulation.
- Discards OCR stderr and unexpected processor errors rather than printing raw OCR text, paths or input images.
- Returns the extracted preview only to the authorized requestor with Cache-Control: no-store. The result marks sourceContentIsUntrusted true, provenanceVerified false, factualRelevanceVerified false, decisionCommitAuthorized false, persistedAsDocument false and executionAuthorized false.

This route intentionally does **NOT** auto-save extracted text as a revision, issue attachment, citation or recommendation. The user must explicitly choose to author and verify a real document before it can become a signed B4 source.

## Actual tests, Mac 2026-10-25

All OCR test images were generated synthetically (no personal documents). English fixture: BOSTAN OCR 4829. Arabic fixture generated with offline Chromium's native Arabic text shaping: وثيقة بستان عربية. Actual Tesseract in language ara returned the complete Arabic fixture string.

- Local service + PostgreSQL HTTP API + company/issue authorization: 8/8 PASS before the concurrency guard, including native Arabic extraction through the real endpoint.
- After adding bounded concurrency: **9/9 PASS** in those same two focused Vitest files. The additional test proved exactly two simultaneous OCR jobs were accepted, a third was rejected as busy, and capacity recovered after exit.
- Wider B4 documentary citation and decision regression, before the concurrency-only edit: **43/43 PASS** across four real PostgreSQL/HTTP suites, including the 8 OCR cases.
- Bostan general Node source suite on the same branch: **123 PASS, 9 Windows-only SKIP**.
- Alibaba Open Code Review local delegate preview: 2/6 files were eligible for static rule selection (not a performed independent AI review). The synthetic PNG fixtures and unit test source were also inspected with focused native Vitest.
- Full server TypeScript check was **NOT qualified** on the resource-limited Mac: direct tsc with a bounded 65-second execution was stopped after no result. Do not present it as PASS.
- No actual user image, cloud AI, provider key, external publication or runtime model invocation was used.

## Outstanding

The OCR Preview endpoint is a tested opt-in backend capability, not yet an end-user image-upload dialog, PDF page conversion, high-fidelity OCR benchmark, durable source-revision linking or OCR-citation handoff. Those features, comprehensive Windows qualification, full server TypeScript, B5 actual free two-agent verified Case approval, installer, performance and external security checks remain open.

GitHub repository stays PRIVATE, inherited Actions disabled, Draft-only and unmerged. **Release NO-GO.**
