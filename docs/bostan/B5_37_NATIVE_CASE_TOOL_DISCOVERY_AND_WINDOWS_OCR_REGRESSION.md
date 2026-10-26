# B5-37 — Named native Case tools and Windows-safe OCR source admission

Private Bostan development, 26 October 2026, stacked on B5-36/PR #149. Do not merge, deploy, publish, run paid models or enable GitHub Actions. License and provenance remain intact.

## Two concrete issues

1. B5-35 previously told a real small free-model Case verifier to make generic raw HTTP requests and to write a report through an unnamed PUT path. Native Runner already advertises narrower authenticated first-party operations. Unqualified vague language can trigger hallucinated HTTP requests or an unsafe host-shell workflow, rather than a signed persisted report. Replace the task instructions with the actual operation names: get_task, list_task_documents, read_task_document, comment_on_task for the specialist; search_api (to discover the EXACT source-snapshot operationId) then call_api; and write_task_document with key=bostan-verification and format=json, followed by read_task_document readback for the independent reviewer. Source document and task IDs are taken only from persisted Case API responses. Refuse malformed IDs and do not claim a pass when the digest or a native tool is missing.
2. The full native Windows source suite on the most recent B5-36 head revealed an OCR build-admission test trying to create a file symlink in TEMP, which failed EPERM because this Windows host does not grant symlink privileges. It was a test setup failure, not an OCR app failure. The test now uses a deterministic fake fs.lstat metadata contract to verify symlink, duplicate-hardlink, empty, directory and oversized file rejection on ANY host, and uses a genuine symlink as additional coverage only where its creation is permitted. The underlying file guard rejects non-regular/symlinked/multi-linked or oversized source bundles.

## Grounded results

- Mac focused source tests: PASS, including native prompt and negative ID probes and OCR metadata.
- Windows latest-head failure before repair: real native Node source run surfaced EPERM at fs.symlinkSync in test, with no evidence of Bostan product defect. Rerun repaired head separately before calling it a pass.
- Do not imply this change has solved the model-driven native report: actual Native Runner remains unable to qualify on the 8-GiB Mac due B5-35 capacity gate; prompt/tool correctness is necessary but not a model E2E pass.
- Main and product runtime unchanged, all changed code is inside explicit QA scripts.

## Remaining release gates

Real model-generated authenticated JSON verifier report and governed Case Done on adequate free host; official full server typecheck/build; installed Windows product test; independent security audit; release NO-GO.

## Verified on the amended B5-37 commit

- Real Windows Abdulaziz Bostan native source Node suite, running the actual updated branch: **165 PASS, 0 FAIL, 7 Windows-specific SKIP** (172 tests total). This resolves the actual EPERM test failure observed on the previous branch. No installer, service, user data or shell security configuration was touched.
- Real macOS native source Node suite: **163 PASS, 0 FAIL, 9 Windows-specific SKIP** (172 tests total).
- Real private macOS source Bostan app/HTTP/PostgreSQL clean stop, restart, persisted company and headless Chromium E2E: **PASS**; page errors 0, blocked external requests 0, clean stop.
- Five official Case/JWT/Native Runner source/PostgreSQL integration suites: **21 PASS, 0 FAIL**, on the amended branch.
- The new native specialist/reviewer tool-name and source digest discovery unit probes pass, but there was NO real model reviewer inference or signed model-authored JSON from this Mac: the unchanged native capacity gate still prevents it. All releases remain NO-GO.

## Safe continuation

To qualify model-led Case on a host that actually meets B5-35 native QA memory/disk limits, keep the source private, use the allowlisted zero-cost model and the native first-party signed bridge (never the legacy host-shell adapter). Never invent source HMAC, schema author or paid-model budget. Require a real independently authored report and original board summary. On Windows, use the separate installed-app QA once the host staging and free-memory gates pass; the successful source tests above are NOT installer qualification.
