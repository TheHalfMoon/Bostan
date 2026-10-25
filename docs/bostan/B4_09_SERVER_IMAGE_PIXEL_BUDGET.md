# B4-09 — Server-side compressed-image pixel-budget gate for private OCR

**Private Bostan source development. No main merge, release, deployment, GitHub Actions, paid model, or cloud image processing.**

## The real memory safety issue

B4-06 bounded source image bytes to 256 KiB; B4-08 bounded the source pixels on the browser side. However, a direct authorized API caller could still send a tiny yet highly compressed PNG or JPEG claiming tens of millions of pixels, potentially exhausting Tesseract memory during decompression. A client-only check does not protect the backend.

## New backend admission

Before writing the caller's image to a temporary file or spawning Tesseract, the OCR service now parses:
- PNG signature, first IHDR chunk type and fixed 13-byte IHDR length; takes width/height from the actual IHDR.
- JPEG SOI marker and bounded JPEG segments up to a legitimate start-of-frame (SOF), taking width/height from the SOF header. It never scans JPEG compressed entropy bytes as if they were segment lengths.
- Rejects zero or excessive dimensions, a width or height above 8,192, or pixel count over 18 million. This matches the existing B4-08 browser budget; server enforcement does not trust its clients.
- Rejects malformed or absent geometry headers. The original 256 KiB, fixed language, MIME/format, canonical base64, concurrency, timeout and untrusted-preview controls remain.

This is an admission check against *claimed image geometry*, not a general-purpose image integrity validator. Tesseract remains the final real image decoder and its errors remain sanitized. It does not validate complete PNG CRC chains or all JPEG format features.

## Real tests on Mac — 2026-10-25

- **49/49 PASS** across four B4 real native suites: image OCR, PostgreSQL/HTTP company-task privacy and access controls, B4 knowledge evidence, and B4 evidence recommendations.
- A real synthetically generated English JPEG was accepted by the real authorized API and recognized by local Tesseract. Existing PNG and Arabic scans still passed.
- Synthetic PNG IHDR and JPEG SOF headers were mutated to zero/9,000/12,000 or 25–144 million pixel claims while retaining small on-disk bytes. The real private HTTP route refused the oversized images with 400 and Cache-Control no-store, without processing them in OCR.
- Bostan Node source regression: **128 PASS, 0 FAIL, 9 Windows-specific SKIP**.
- No external model, API, web upload, user documents, or paid compute used.

## Remaining release work

PDF OCR, scanner corrections, real field-document accuracy benchmarks, installed Windows OCR bundle, B5 real first-agent and second reviewer proof, full server TypeScript and release/security gates remain open. The original source repository stays Private; GitHub Actions disabled; Draft PR unmerged. **Release NO-GO.**
