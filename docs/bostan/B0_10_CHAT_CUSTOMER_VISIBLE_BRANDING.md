# B0-10 — Bostan-native customer-facing chat/identity copy

Private Bostan development on 26 October 2026. Draft stacked on B6-31/PR #158. No main merge, release, deploy, inherited GitHub Actions or paid models. Donor license/NOTICE requirements remain.

## Scope grounded in open B0-09, issue #35

B0-09 calls for separating visible donor branding from stable internal protocol fields and legitimate upstream identity. Bounded search found inherited customer-facing product references in:
- Slack owner confirmation and external-identity linking
- Slack own-app setup and test-message permissions
- Photon dedicated-number guidance
- Conversation list fallback title
- AgentMail low-trust boundary guidance

Only these seven rendered UI modules change customer-visible text to Bostan. No persisted schema, company ID, Slack app identity, third-party host, legal provenance, OAuth path or permission decision changed. The Slack identity paperclipUserLabel property remains a compatibility API field; only surrounding display copy now reads Bostan. Third-party, external check identifiers and legal notices are not blindly renamed.

## Verification

- Added 8 native cross-platform source tests requiring Bostan UI copy in the seven bounded modules and protecting the original API property.
- Updated the Slack ownership confirmation UI test.
- Five related chat/identity UI suites: 120 PASS, 0 FAIL.
- Official UI TypeScript project and Vite build: PASS (pre-existing large bundle advisory).
- Mac Node source: 173 PASS, 0 FAIL, 9 platform SKIP (182 total).
- Native Windows source, real private Chromium/PostgreSQL and canonical Case/JWT/PG results recorded upon exact-head completion.

Open B0-09 branding task is not fully closed by this bounded UI copy pass. Official entire-server compile/build, native model-driven independent Case verification and terminal completion, installed Windows application, and independent comprehensive security signoff remain NO-GO.

## Exact-head live checks

- Five real canonical native Case/JWT/HTTP/real disposable PostgreSQL suites: 22 PASS, 0 FAIL.
- Real local Bostan source HTTP/PostgreSQL persisted company, clean stop/restart and headless Chromium private UI: PASS, 0 page errors and 0 blocked external requests, clean stop.
- Windows native source test results are appended after verification on this same code branch.

## Real Windows cross-platform verification

Native Windows Abdulaziz on the exact B0-10 source head: 175 PASS, 0 FAIL, 7 platform SKIP (182 total). The three pre-existing untracked Windows QA scripts remain untouched. No native Windows installer was run or declared qualified; do not conflate source and installed-package tests.
