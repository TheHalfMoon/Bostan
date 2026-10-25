# B6-16 — Route-scoped IssueDetail bundle instead of a global startup dependency

Private Bostan source development. No main merge, public release, deployed frontend, model inference, paid provider or enabled inherited GitHub Actions.

## Actual performance problem and root cause

The previous production Vite bundle had an issue-detail JS chunk of 3,949,200 bytes. Its index.html injected a modulepreload link on every app route, including authentication and dashboard. Removing that injected link alone was INSUFFICIENT: actual Chromium still downloaded the large IssueDetail chunk on a non-task dashboard. A true browser test exposed this flaw.

Bundle inspection showed why: the explicit Rolldown codeSplitting group named issue-detail made its forced chunk a common dependency of dozens of lazy route imports, including Dashboard. Thus removing only the HTML preloader did not remove the real network dependency.

## Implemented

- Remove the unconditional build-time modulepreload injection for IssueDetail from index.html.
- Remove the forced Rolldown issue-detail chunk group, while retaining the existing board-startup strategy and native automatic route splitting.
- Preserve React.lazy loading for IssueDetail and its existing prefetch limited to company issues/tasks/inbox routes.
- Add source regression for the absence of global preloads/forced chunk grouping and presence of route-based lazy loading.
- Add separately opted-in actual synthetic Chromium test (BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E=1, also requiring the existing real browser/private source confirmation). It creates a disposable persisted task, opens the real company-prefixed Dashboard, asserts no IssueDetail JS request, then navigates to that task and asserts one IssueDetail chunk fetch and actual task text rendered. No external requests are allowed. This is a per-route test, not a blanket prohibition on prefetching on the task/inbox UI.

Initial live browser tests mistakenly began on the root route that can legitimately restore an Inbox task view; that was corrected to a deterministic company Dashboard. A follow-up still failed, demonstrating the forced-code-splitting dependency. The build grouping was then corrected and the complete live test rerun successfully. Both failures were test/dependency evidence, not claimed as passing.

## Actual results, Mac, 2026-10-26

- Prior IssueDetail JS shared chunk: 3,949,200 bytes, globally requested.
- New automatically split IssueDetail chunk: 612,047 bytes; no IssueDetail modulepreload in production HTML. Other editor/diagram chunks remain and still trigger an existing nonfatal large-chunk warning; this does NOT claim the entire app is under 500 KiB.
- Real private Bostan + PostgreSQL stop/restart + Chromium Dashboard -> persisted synthetic task browser acceptance: BOSTAN_LOCAL_PERSISTENCE_E2E_PASS, exit 0. Initial IssueDetail chunk request count 0; after task navigation count 1; actual synthetic task visible. Browser JavaScript errors 0, external requests 0, clean shutdown.
- UI TypeScript: PASS. Vite production build: PASS.
- All Bostan Node source tests: 146 PASS, 0 FAIL, 9 Windows-specific SKIP (155 total).
- 21 focused source/browser admission/lazy-loading unit tests also passed prior to the real Chromium acceptance.

## Remaining release gates

This is a verified reduction in the unnecessary Dashboard/authentication load of the IssueDetail bundle, not a full startup-latency benchmark. Browser/network timing and full app performance across devices, signed installer, native installed Windows UI, full server TypeScript, security signoff and B5 model-backed first-agent/independent-reviewer/Case still need separate qualification.

Repo PRIVATE, Actions disabled, stacked unmerged Draft PR. Release NO-GO.
