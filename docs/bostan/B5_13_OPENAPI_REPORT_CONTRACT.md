# B5-13 — Align OpenAPI and native runner report contracts

Private development, October 25 2026. Do not merge, deploy, publish, release, enable Actions, or use paid models.

The B5-11 original REST PUT accepts markdown for normal issue documents and JSON only for strict `bostan-verification` reports authored by an active, assigned, independently delivered reviewer. B5-12 exposed that option to the native runner task writer. However the registered OpenAPI contract still advertised `upsertIssueDocumentSchema` (markdown only), misleading generated agent clients and documentation. B5-13 now declares a bounded Markdown-or-JSON union for this existing endpoint and describes the route's **conditional key, current run, tenant, task, case and reviewer handoff requirements**. OpenAPI alone does not expand authority; the original B5-11 REST route still refuses unauthorized or wrong-key JSON, and the native first-party tool keeps its own key guard.

The Runner API `validateRunnerApiCall` checks generic JSON object/array shape, not nested JSON enum fields, so the old OpenAPI metadata was a guidance/contract mismatch, not independently proved to block actual dispatch. B5-13 corrects the published contract rather than claiming it fixed a rejection never observed.

Test: 17/17 PASS across four tests: 14 real isolated PostgreSQL/Express/Case/Issue/source HTTP checks plus 3 native tool schema and actual built OpenAPI runner catalog checks. The OpenAPI test asserts that the true Runner catalog lists both Markdown and the reserved Bostan JSON exception. No model or provider invoked. Complete native-to-server model transport, server TypeScript compile on capable hardware, real effect readback, Windows/browser, B4 analytics, B5 full company sequence and B6 distribution remain open. Repo private, Actions disabled, main unchanged. NO-GO.

Latest-head local source-app check:
`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs` **PASS exit 0**, original private HTTP health, isolated PostgreSQL company create, clean stop/restart and exact company persistence, clean second stop and temporary test HOME cleanup. `git diff --check` PASS.
