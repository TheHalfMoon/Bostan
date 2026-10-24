# B3-04 — Current-state recheck anchored to an existing signed file receipt

**Private Bostan development, 2026-10-24; not an effect verifier or release.**

## The temporal correctness gap

B3-03 signed and durably persisted a server-side file-content observation at
one instant. A historical authenticated receipt cannot by itself prove that
the file still has the same contents when the board later reviews it. Nor can
an arbitrary new hash/path supplied in another request be silently treated
as revalidating the original receipt.

## Source-first implementation

- Reuse the exact imported company/issue/workspace-bound B3-02 secure file
  reader and B3-03 HMAC-signed `workspace_operations` receipts. No new
  workspace authority, independent task writer, secrets API or database table.
- Add `POST /api/tool-gateway/bostan-local-file-readback/:receiptId/recheck`
  for the authenticated **board** with both `tools:view_audit` and
  `tools:manage_runtime`. Inputs are the original exact scoped company,
  invocation and workspace UUIDs, relative path, expected SHA-256, and
  expected byte size. This endpoint never accepts a workspace root from
  agent text or HTTP.
- First verify the original receipt's private HMAC and the persisted
  company/issue/workspace row binding. Only then compare the source request
  fingerprint with an HMAC over **all** newly supplied source identifiers,
  relative path, SHA and byte size, using a constant-time comparison.
  Original receipt manipulation, foreign tenant, different path, different
  expected digest or invalid source binding refuses this recheck (409/404).
- On exact commitment match, independently open the current file through
  the original no-symlink confined opener again, then write a **new** signed
  host readback receipt. Return prior and new receipt UUIDs and the new safe
  content state. The original historical receipt stays immutable.
- Every response retains `independentEffectVerified: false` and
  `autoRetrySafe: false`; no readback can cause tool execution or spending.
  This is a board-initiated point-in-time observation, not a guarantee that
  the state will remain unchanged in the future.
- Readback receipts contain no raw file bytes, actual filesystem path,
  unkeyed SHA, passwords, tool-result body or external provider secrets.

## Verified macOS PostgreSQL and filesystem tests

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-action-evidence-status.test.ts --maxWorkers=1`

**9/9 PASS, 0 FAIL/SKIP**, including three actual PostgreSQL/Express
integration cases and six real filesystem/classifier cases. The real HTTP
journey additionally asserts refusal on mismatched original path or digest;
rejection of a deliberately tampered original HMAC receipt; an authorized
same-request recheck creates a distinct, valid signed receipt; a later real
file edit is detected as `content_mismatch` even while the original remains
valid; the new mismatch receipt is itself signed; agents/other companies are
rejected. The original B3-01–03 regressions remain green.

## Limitations and release gates

- Rechecking current bytes **does not prove the referenced tool caused the
  mutation**, that the tool was authorized, or that provider/browser state
  outside this local file is correct. Signed before/after evidence captured
  around a real authorized run and a separate causal verifier remain open.
- Rechecks always use the existing macOS/Linux restricted file opener;
  Windows file-readback release is not qualified. Duplicate/signed receipt
  lifecycle, signing-key rotation, real connector/browser effect verification,
  and unknown-outcome reconciliation remain future B3 tasks.
- The full backend TypeScript compile and full cross-platform first-agent
  integration remain unqualified on resource-bounded Mac hardware; passing
  Vitest and a local app smoke cannot substitute for them.
- No paid model or connector, live customer file, public deployment, merge or
  release. Private GitHub, inherited Actions disabled, main unchanged.
  **RELEASE NO-GO.**

## Latest-head actual source application acceptance

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
**PASS, exit 0** on Mac. It launched a fresh private Bostan/PostgreSQL
instance, verified private HTTP health, inserted a synthetic company,
performed a graceful stop, restarted, confirmed exact company persistence,
and stopped gracefully again. Its temporary test profile was cleaned.
`git diff --check` PASS. A source app persistence smoke is not real
remote-provider action, Chromium UI, Windows installer or whole TypeScript
qualification.
