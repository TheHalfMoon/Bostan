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
