# B4-10 — Authorized real task throughput and cycle-time insights on Dashboard

Private Bostan source development. No main merge, public release, deployment, inherited GitHub Actions or paid model.

## Feature

Bostan Dashboard already shows agents, task status, spend and runs. This addition introduces genuine, separately labeled task-flow metrics on existing PostgreSQL data, never a fabricated conversion/completion rate.

GET /api/companies/:companyId/bostan-analytics/task-insights?days=7|30|90

Response schema: bostan.task-insights.v1, with asOf, windowStart, days and visibility grain.

- Current snapshot: authorized visible operational tasks, open, blocked.
- Period flow: actually created in the rolling UTC window, currently Done tasks with completedAt in the window.
- Median started-to-completed hours only for Done tasks with valid startedAt and completedAt, including sample count, null for no usable sample.
- Created and completed tasks have different denominators. Do not display them as completion rate.

## Privacy and implementation

Only board-authorized requests with company access, company_scope:read and the existing canonical issueReadSqlCondition enter the aggregation. Agents, foreign tenant boards and invalid day ranges fail. Hidden and harness-internal issues do not enter aggregates. Private task records are excluded for actors who cannot read them. PostgreSQL performs counts/median without fetching task text, document content or agent logs. Cache-Control is private, no-store.

The production Dashboard displays Task insights with 7/30/90 buttons, created/completed counts and median cycle hours. It rejects stale period response, never shows private API errors, and never starts a model or affects stored task state.

## Actual Mac evidence — 2026-10-25

- B4 native PostgreSQL and HTTP suites: 53 PASS across 5 files, no failure.
- UI component tests: 10 PASS across two files, no failure.
- Bostan general Node tests: 129 PASS, 9 Windows-specific SKIP, 0 FAIL.
- UI TypeScript and production Vite build PASS.
- Real private Bostan/PostgreSQL clean stop/restart and real Chromium company-prefixed Dashboard: BOSTAN_LOCAL_PERSISTENCE_E2E_PASS exit 0. A synthetic task existed in database; React displayed true task insights and created-task metric. JavaScript page errors 0 and external HTTP requests 0. Clean shutdown.
- During development, raw SQL Date parameters were corrected to explicit ISO UTC timestamptz; foreign-tenant negative test was corrected to limited session membership rather than the intentionally powerful local implicit board actor. An initial test used the wrong global dashboard route, corrected to the actual company-prefixed route. Final tests and real browser passed.
- Alibaba OCR local review delegate is static source selection only, not an independent AI-based security audit.

B5 real free model first-agent completion and independent reviewer/canonical Case, full Windows installed UI, package, full server TypeScript and security review are still OPEN. Repo private, Actions disabled, Draft/unmerged. Release NO-GO.
