# B6-29 — App-detail, Browse and credential-recovery error privacy

Private Bostan development, 26 October 2026, stacked on B6-28 / Draft PR #155. No merge to main, deploy, publish, inherited Actions, paid inference or deletion of required legal donor notices.

## Actual unsafe UI surfaces

B6-27/B6-28 sanitized the MCP configuration and connection setup dialogs, but the normal Apps experience still reflected provider-controlled health and failure strings:
- An app-detail query failure rendered raw Error.message inside an alert; a transient access warning rendered raw connection.healthMessage.
- A ReconnectCard showed raw connection.healthMessage, and the credential replacement flow copied both thrown error.message and an *unsuccessful credential probe's successfully returned* connection.healthMessage into operator toasts.
- The main Apps Browse attention summary preferred raw healthMessage / lastError over the existing generic guidance.
- The OAuth start/personal authorization/reconnect navigation and Vercel/GitHub credential-recheck paths could echo their failed provider URL, OAuth code, bearer token or authorization state into toasts.

Upstream tool/identity error content must not be treated as display-safe, even if it arrives in a successful HTTP response.

## Scoped fix

Extend the existing fixed-copy safeCredentialUiError helper with appLoad, appHealth, appReconnect and appCredential variants that ignore the untrusted exception or health payload entirely.

Route those specific UI displays through static Bostan copy. This deliberately trades detailed provider troubleshooting messages for protection of credential-bearing user UI. Health statuses, owner identity, reconnect actions, authorization routing, successful key replacement, enterprise/personal connection ownership and all backend API contracts are unchanged. No regex-based partial masking and no logging of secret payloads were added.

Correct stale Bostan branding expectations in the existing Apps Browse tests (they still expected the donor product's user-facing label and removal-dialog copy). Product source already displayed Bostan; internal donor protocol IDs and mandatory legal notices were left untouched.

## Actual negative and regression tests

- Three real React/jsdom app UI and fixed-copy files: 188 PASS, 0 FAIL.
- App-detail component test rejects loading errors containing a synthetic bearer token, suppresses a token-bearing provider health warning, and tests both rejected replacement-key mutation and an unhealthy-but-successful provider response containing signed-token URLs. Neither DOM nor toast may contain synthetic secrets.
- Browse attention test injects a synthetic bearer token into a successful connection object and requires safe static copy and no marker.
- The fixed-copy helper is tested against bearer tokens, OAuth codes, callback states, signed URLs and arbitrary error objects.
- Official UI TypeScript project tsc -b and Vite production UI build: PASS (existing large-chunk warning).
- Native Mac Bostan Node source suite: 165 PASS, 0 FAIL, 9 platform-specific SKIP (174 total).
- Five original canonical native JWT/HTTP/real PostgreSQL governed Case suites: 22 PASS, 0 FAIL.
- Source Chromium/PostgreSQL persistence and native Windows source suite recorded separately on this exact head.
- This does NOT establish a comprehensive independent security audit, security of every chat endpoint, or successful real independent model-driven Case completion.

Release NO-GO. Still open: official whole-server compile/build on resource-qualified hardware, installed Windows package/browser testing, real signed model-authored independent verifier report and complete governed Case approval, external-effect consent/readback qualification, independent comprehensive security review.

## Final exact-branch integration and Windows QA

- The real private source Bostan HTTP/PostgreSQL clean stop, restart, persisted-company readback and headless Chromium UI: PASS, page errors 0 and external blocked requests 0, clean stop.
- Native Windows Abdulaziz source Bostan Node suite at B6-29 code head: 167 PASS, 0 FAIL, 7 Windows-platform SKIP (174 total). Windows installer/application E2E was NOT attempted on the host with insufficient free RAM and staging storage. Existing Windows untracked QA scripts and user applications were not touched.
- The Mac source broad 165 PASS / 9 platform SKIP, source UI 188 PASS, UI TypeScript/build PASS, and 22 canonical signed Case/PostgreSQL test PASS all apply to this code head.

Those source and browser passes must not be confused with the still-unqualified full Windows-installed-app or real native model-written independent Case signoff.
