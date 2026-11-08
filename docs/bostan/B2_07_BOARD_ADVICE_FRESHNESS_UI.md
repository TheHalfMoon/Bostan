# B2-07 — Make board evidence/budget freshness visible and fail-closed in the existing UI

**Private, development-only Bostan interface improvement; no public launch.**

## Integration

- Reuse the existing `DecisionResolver` + `DecisionCard`/Attention board review
  UI, not a parallel dashboard or a new decision state manager.
- Add a typed `decisionsApi.freshness` client for the board-only B2-06 route.
  For `ruleKey=bostan.decision_recommendation.v1` and open decisions, the
  resolver reads this private endpoint with TanStack Query. Background refresh
  every 15 seconds, a short staleness window and refetch on focus limit
  confusing stale views. No extra requests for non-Bostan decisions.
- Display a plain board advisory in the existing decision card: checking;
  evidence/budget snapshot currently matches; or evidence/budget changed and
  review is needed. No balances, HMACs, internal policy IDs or document text
  are displayed in the status.
- **Fail closed on the front end:** disable positive choices until the board
  freshness query succeeds with `positiveChoiceAllowed:true`, including when
  the request errors; always keep zero-effect `defer`/`request_evidence`
  choices available. Existing non-Bostan decisions remain unchanged.
- Before submitting a positive Bostan choice, the resolver **re-requests**
  the status from the actual server. If stale, show a clear error rather than
  attempting the commit. This is usability only: B2-05's locked,
  authoritative database recheck still independently decides whether a
  positive board choice is valid. The UI never grants external effects.
- Invalidate freshness caches alongside the existing decision/attention
  cache invalidation after a successful outcome.

## Source-level QA on macOS

- `pnpm --filter @paperclipai/ui exec vitest run
  src/components/DecisionCard.test.tsx src/components/DecisionResolver.test.tsx
  --maxWorkers=2`: **20/20 PASS**, zero failing tests. Three B2-07 tests
  cover disabled positive review while checking, stale blocks positive but
  allows defer, and fresh permits positive review.
- `pnpm --filter @paperclipai/ui exec tsc -b --pretty false`: **PASS, exit 0**.
- `CI=1 pnpm --filter @paperclipai/ui build`: **PASS, exit 0** (the normal
  inherited JavaScript chunk-size warnings still exist; they are not a
  build failure).
- `git diff --check`: PASS. No paid model, cloud deployment or external
  customer data was used.

## Remaining acceptance

The UI tests exercise React components in jsdom and a real Vite bundle.
They are **not** an interactive screenshot/Chromium first-run journey, nor do
these tests by themselves validate a real cross-platform installed app. A
browser-level acceptance run of the integrated recommendation + board
review remains open. Full-server TypeScript has not been qualified on recent
B2 branches, despite the successfully typechecked UI. Independent citation
relevance, real model outputs, B3–B6, and installer/release remain NO-GO.

Source licensing/provenance stays preserved. Repository private, inherited
GitHub Actions disabled and `main` unchanged. This wave is Draft only.

## Latest-head real source application smoke

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`:
**PASS, exit 0** on Mac after the new UI production build. Private localhost
health, real disposable PostgreSQL company insert, clean shutdown, restart
with exact persisted company and second clean shutdown. The temporary HOME
was cleaned. This is not a live browser screenshot of board decisions.
