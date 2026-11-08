# B0-79 — Native Bostan branding in runtime notices and user-facing operations

**Date:** 2026-10-28. Private stacked Draft based on B0-78 PR #227 (`0b83175afc38d7bc232b266bd8575c8506f99f81`). Keep repo PRIVATE, GitHub Actions disabled, Draft/unmerged, no release or paid AI.

## Scoped product changes

Rebranded **16 first-party terms** across 11 product files so actual Bostan runtime notices refer to Bostan, not its upstream donor: app announcements' accessibility label; system/authorship defaults in issue chat; resumed agent approval failure and authority-review copy; standalone browser native share title fallback; workspace long-running command supervision; subscription-cost descriptions; dev-restart confirmation; blocked-task messages; agent retry helper; Board Chat and Plugin Manager developer comments. Five existing React component assertion files were updated to the new user-visible copy.

**Safety:** Only first-party natural-language copy, labels and comments changed. No provider routing, agent adapter type, upstream literal protocol name, login token, cloud account, UI DOM state machine, actual GitHub App identity, license attribution, runtime permission policy or database key was changed. The Lucide `Paperclip` attachment icon and `usePaperclipIssueRuntime` compatibility symbol are preserved on purpose.

## Actual verification

- Real component tests for AnnouncementWell, DevRestartBanner, AgentLifecycleStatus, IssueBlockedNotice, IssueThreadInteractionCard, StandaloneBrowserControls, SubscriptionCostCard, WorkspaceRuntimeControls and IssueChatThread: **254/254 PASS across 9 files**, zero failures or skips. React test warning about unwrapped Tooltip `act(...)` updates is pre-existing in tests and does not change PASS status.
- New native regression tests `scripts/bostan-runtime-first-party-brand-copy.test.mjs` check all 11 files and protection of adapter/Lucide names; **2/2 PASS**. Prior B0-78 connector-brand tests remain **3/3 PASS**.
- Official `pnpm --filter @bostan/ui typecheck` **PASS exit 0** (generated 316 Storybook catalog files and 2,973 stories; ran `tsc -b`). Production Vite8 `pnpm --filter @bostan/ui build` **PASS exit 0** (~2.7 s, only pre-existing large-chunk warnings). Both ran against the exact B0-79 source changes, not inferred from unit tests.
- Source whitespace `git diff --check` performed.

## Open work

Hundreds of remaining `Paperclip` occurrences in the repository include true external Cloud/GitHub identities, third-party legal material, compat symbols, internal adapter names, tests, genuine upstream/donor samples and additional user-facing labels. They are **not** interchangeable and need classification before rename. End-user Windows installer, full third-party license/security audit, genuine free-model agent work and release remain **NOT QUALIFIED**. Overall Bostan **NO-GO**; do not publish.
