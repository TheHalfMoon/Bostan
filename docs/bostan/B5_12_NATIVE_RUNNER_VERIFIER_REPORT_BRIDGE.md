# B5-12 — Native Runner verifier report tool

Private Bostan, October 25 2026. No merge, deploy, publish, release or paid models.

## Problem and fix

B5-11 lets an actively running assigned verifier write a strict B4-cited JSON report over the original authenticated issue REST path, but the actual native `write_task_document` tool always dispatched Markdown. B5-12 gives that native tool an optional `format:markdown|json` with Markdown default; JSON is allowed only for `key:bostan-verification`. Original runner API/tool availability gates remain unchanged (standard run and permitted task API). The tool authority forwards the format to the existing REST route and refuses JSON for other task documents before dispatch.

The REST route still enforces tenant, current assigned agent/run, independently delivered verification handoff, strict report shape, version provenance and source freshness at final Case/Issue completion. The separate public OAuth MCP operates as a human, not an agent; no human MCP scope was widened.

## Real tests on Mac

16/16 PASS, four Vitest files: 14 live disposable PostgreSQL/Express/case/issue tests and 2 native runner tool-schema/availability tests. Verified Markdown default, explicit JSON input, rejected unsupported format and oversized body, denied JSON outside reserved key, and tool invisibility without API permission or outside standard mode. No real AI model or provider executed.

The full original native tool-authority execution/transport was not tested on this host; the tests establish tool-schema/authority predicate and source REST behavior separately. Full server TypeScript on a capable machine, real native model execution, third-party effect readback, B4 analytics, B5 autonomous acceptance, Windows/Chromium, B6 installer and release remain open. Repo private, Actions disabled, main unchanged. NO-GO.

Latest-head `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`: PASS exit 0, actual localhost server health, isolated PostgreSQL create, synthetic company, clean stop/restart with exact persistence, second clean stop and disposable profile removal. `git diff --check` PASS.
