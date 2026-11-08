# B4-08 — Local large-image normalization for bilingual OCR

Private development. No public release, main merge, deployment, GitHub Actions, paid AI, or transmission of source images to a third-party service.

## Why

The B4-06/07 backend accepts only 256 KiB of canonical PNG/JPEG image data. This keeps the backend OCR subprocess and private HTTP request bounded, but many ordinary phone/camera/scanner images are larger than that limit. Simply increasing the backend allowance would expose Tesseract and the source app to a larger memory and processing budget per request.

## Added

The B4-08 client prepares larger images **inside the browser**, then uses the existing authorized same-origin B4-06 endpoint without changing its size cap, signed-evidence rules, company/task ACL or default-off flag.

- Accepts only PNG/JPEG and at most **4 MiB of original image bytes**; empty, other MIME and larger files are refused **before decoding**.
- Images up to 256 KiB retain the original lossless bytes and MIME.
- For images above 256 KiB, uses browser-native createImageBitmap and a private canvas. Checks source dimensions <= 8,192 along either side and pixel count <= 18 million before canvas allocation. In particular, invalid source dimensions fail without calling the task OCR API.
- Paints on white (to safely flatten transparency), uses browser-native image resampling, and iteratively tries bounded image side lengths 2000/1700/1450/1200/980 and JPEG quality levels 0.86/0.73/0.59/0.45 until the **output JPEG** fits 256 KiB.
- Fails clearly if no admitted image fits rather than bypassing the server size limit. No additional runtime package/model/cloud provider was introduced; the original blob stays local to the browser and the bitmap is closed in a finally block.
- Aborts an already-canceled process before decode or at each output generation stage. Closing the OCR panel also aborts the same-origin request and clears stale preview state.
- Maintains the B4-07 OCR output as read-only, untrusted, nonpersistent, not a verified citation, and not execution-authorizing. No document write is implied.

The source-side synthetic browser QA has a *separately opted-in* large-image stage under BOSTAN_LIVE_LOCAL_BROWSER_LARGE_OCR_E2E=1, also requiring existing real browser/private source OCR opt-ins. It generates a deterministic synthetic Arabic text scan with noise, verifies original PNG is bigger than 256 KiB and <= 4 MiB, and inspects the actual browser's POST to confirm MIME changed to image/jpeg and resulting bytes are <= 256 KiB. After actual local Tesseract processing, the browser must visibly show the word بستان and actual issue documents must remain unchanged.

## Actual Mac results, 2026-10-25

- Real Bostan source app, isolated PostgreSQL, actual Chromium React UI, actual locally normalized synthetic Arabic image, real Tesseract recognition, private REST readback and clean stop: **BOSTAN_LOCAL_PERSISTENCE_E2E_PASS, exit 0**. Verified source flags included real-browser-bilingual-ocr-no-document-write and real-browser-large-image-local-jpeg-preprocessing.
- Browser JavaScript errors: **0**. Attempted external HTTP requests: **0**.
- UI tests: **18/18 PASS** (including negative tests for 4-MiB cap, mocked 9,000x9,000 source pixel refusal before creating a canvas, canceled operations, positive in-browser JPEG conversion and callback cleanup).
- UI TypeScript typecheck: **PASS**.
- Bostan Node source regression: **126 PASS, 0 FAIL, 9 Windows-only SKIP** (135 cases).
- UI production Vite build with OCR opt-in: **PASS**. Chunk-size warnings are pre-existing nonfatal build advisories.
- Local Alibaba OCR delegation is file/rule selection, not independent model-based review.
- Previous B4-06 native SQL/HTTP/Tesseract tests and B4-07 default-off mode remain documented in their respective waves.

## Limits/open gates

This is not a PDF converter, professional OCR accuracy evaluation or OCR source-trust verifier. No automatic scanning deskew, denoising, orientation recognition, PDF page rendering, document-save approval UI or Windows Tesseract packaging was qualified. Even a 4 MiB compressed file might have expensive decode characteristics; the pixel cap is checked **after browser bitmap decoding**, though before canvas allocation. The true standalone Windows browser/machine and full server TypeScript release gate remain open.

B5 free-provider independent agent lifecycle, current-source Case attestation, B4 analytics, security and installers remain OPEN. Repository Private, Actions disabled, Draft PR only, main unchanged. **Release NO-GO.**
