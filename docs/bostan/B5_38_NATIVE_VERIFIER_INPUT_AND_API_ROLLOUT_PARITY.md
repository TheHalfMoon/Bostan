# B5-38 — Native reviewer creation schema and signed API availability

Private Bostan development on 26 October 2026, stacked on B5-37 PR #150. Do not publish, merge into main, deploy, enable inherited Actions, use paid models or perform external effects.

## Real contract defect

The B5-37 reviewer prompt told a real native agent to call write_task_document with key=bostan-verification and format=json, but omitted baseRevisionId. The actual Bostan native RUNNER_BRIDGE_SCHEMAS for write_task_document require baseRevisionId: a valid UUID or **explicit null**, even when creating a new document. Leaving it out causes schema rejection before the authenticated JWT/HTTP/PostgreSQL report guard is reached.

Fix only the disposable native Case reviewer instructions: pass baseRevisionId=null explicitly, keep format=json, and supply taskId on all read/write task-document calls. Never substitute an unverified HTTP action or pretend that a final chat message is a saved report.

Added a real server-native Zod contract regression proving null accepted for creation and missing/empty/malformed revisions rejected. This test is grounded in the exact active tool schema, not a duplicated/mock schema in the QA script.

## Signed API tool rollout preflight

The native verifier also needs active search_api and call_api to discover and retrieve the current signed source-snapshot HMAC. Server policy defaults these tools ON, but external settings PAPERCLIP_RUNNER_API_TOOLS_ENABLED can disable them, and PAPERCLIP_RUNNER_API_TOOLS_COMPANY_IDS can restrict them to a static company list. The private E2E generates a RANDOM synthetic company per run, so a predefined company allowlist cannot contain its future identity.

The private QA driver now fails closed during admission when tools are disabled or any static company allowlist is configured. This does NOT modify server rollout configuration, open permissions, bypass access checks, read protected data, or start a test model.

## Evidence and limits

- Real native tool Zod schema targeted suite: PASS (4/4) including required explicit null.
- Synthetic governed Case admission and prompt tests: PASS (9/9), including disabled/allowlisted API settings.
- Full broad Node/Case suites and real source browser pass evidence is recorded separately when verified on this exact head.
- No new live model result is claimed. The 8-GiB Mac fails the B5-35 full native model-run resource admission. Actual model-authored independent JSON Case and board closure are still unqualified.
- Official full server build/typecheck, installed Windows app, and independent comprehensive security review remain open. Current release NO-GO.

These are test and prompt hardening changes, not evidence that the project is now release-qualified.

## Completed exact-head native and browser verification

- Windows Abdulaziz native Bostan Node source suite at B5-38 code head: **166 PASS, 0 FAIL, 7 SKIP**, 173 total; no installer or Windows user configuration modified.
- Mac native Bostan Node source suite: **164 PASS, 0 FAIL, 9 SKIP**, 173 total.
- Five real disposable PostgreSQL Canonical Case/JWT/Native Runner source test files: **22 PASS, 0 FAIL**, including the new null-vs-absent native write_task_document bridge schema proof.
- Source Bostan app, PostgreSQL clean stop/restart, company persistence and actual headless Chromium private UI: **PASS**; zero browser errors and zero blocked outbound requests.
- These do not qualify a real free-model-led reviewer authoring report or native Windows installed application.
