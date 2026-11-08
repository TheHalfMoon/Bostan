# B0-08b — Resume a deferred first agent after browser reload

**Status: focused Bostan first-run usability improvement, not model execution or release approval.**

## Lineage

- Parent B0-08a Draft PR #36 at commit `0b52b1daad23b767c242782be882134da94fb59d`.
- Work branch: `work/b0-onboarding-resume` (separate stacked Draft PR).

## Product behavior

- Deferring AI configuration still requires a server-confirmed `paused/setup` agent belonging to the current company; it does not hire, wake, schedule, or run the worker.
- The wizard now keeps the current, non-secret browser onboarding draft rather than clearing it when navigating to Agents. The old browser-storage key is **retained solely for backward compatibility**.
- The agent list exposes **Finish AI setup** only when an eligible paused agent matches that browser's saved draft by company, agent ID and step. An active agent, a different company's agent or a changed/invalid draft cannot receive the CTA.
- Clicking the CTA opens the existing provider connection screen against the same saved setup. If the agent was already hired or the server has changed its state, the normal onboarding hire validation continues to control progression.
- All provider selection, credentials and environment tests still apply; the resume CTA never turns an unconnected draft into an operational AI worker.

## Actual evidence

- `pnpm exec vitest run ui/src/lib/onboarding-defer.test.ts ui/src/pages/Agents.test.tsx ui/src/components/OnboardingWizard.test.tsx`: **213/213 PASS**.
- `pnpm --filter @paperclipai/ui typecheck`: **PASS**.
- `pnpm --filter @paperclipai/ui build`: **PASS**, inherited nonblocking bundle-size warnings.
- Playwright/Chromium against disposable localhost Bostan source runtime and PostgreSQL: created company and draft agent, deferred without any model keys, reached Agents list, refreshed browser, clicked **Finish AI setup**, returned to model connection screen, verified via backend that exactly one agent with the same UUID remains in paused setup. **PASS**.
- Temporary app-run state cleaned up on tested shutdown. No user-owned instance or real model/account touched.

## Future gates

- Full provider login/AI agent's first real task not qualified.
- Standalone desktop packaging, Windows/macOS installer regression, concurrent browser/edit conflicts, full data backup/restore and egress hardening remain open.
- Other imported user-facing names and internal compatibility identifiers remain to be migrated carefully.
- GitHub Actions disabled, staged Draft PRs unmerged, release NO-GO; do not publish.
