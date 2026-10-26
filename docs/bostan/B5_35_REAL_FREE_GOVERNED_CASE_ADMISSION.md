# B5-35 — Real free-model governed Case qualification: strict native admission, not a release pass

Private Bostan development, 26 October 2026. Do not merge to main, release, deploy, make public, enable Actions or use paid models. Attribution and donor licensing are unchanged.

## Actual goal

Exercise an original canonical Bostan Case with a real specialist and a separate model-driven verifier. Require each exact agent/run, a persisted source receipt, a delivered Case handoff, an authenticated verifier-owned bounded JSON report with current source snapshot HMAC, original Case + Issue Done, board readback of current signed provenance, and zero or *unknown* (never invented) reported model cost. The driver cannot mark a Case passed from conversational output or from a synthetically written verifier report.

The opt-in driver is scripts/bostan-governed-case-free-e2e.mjs, integrated with the disposable source runtime under BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E=1. It requires separate real free-agent/remote-free/temporary-data confirmations, a local managed HOME/lock and exact localhost, an allowlisted free model, zero dollar agent budgets, and two distinct agents. These tests are NOT enabled in normal Bostan startup.

## Actual findings (no PASS invented)

1. Native OpenCode free-provider admission: **PASS** with opencode/deepseek-v4.1-flash-free on a disposable test. This qualifies *one free model availability probe*, not ongoing pricing, the native bridge, or model quality.
2. First legacy E2E: source agent completed an exact real assignment run; an automatic follow-up execution began before the board reassigned the Case. The handoff captured this follow-up run, then was cancelled by the existing run-ownership guard. Case not Done. This is the correct fail-closed behavior. A test was added to refuse terminal or foreign run handoff evidence.
3. Second legacy E2E: bound the handoff to the actual source assignment run while its attributed comment was persisted and the run remained active. The specialist run succeeded, independent reviewer run succeeded, verification handoff delivered, usage cost 0/0. **However NO bostan-verification report was persisted**; original Case remained draft, no Case Done attempted. Reviewing the bounded run trace exposed the legacy opencode_local model's general-purpose shell tool. This is NOT a safe substitute for first-party signed Case tool arguments; no shell-based output is accepted as a formal review receipt.
4. Switched the governed Case driver to **paperclip_runner** native OpenCode provider, with explicit opencodePermissionMode: deny and lifecycleMode: per_turn. The pinned native bridge uses qualified opencode-ai 1.18.34 and signed first-party paperclip tool transport; provider built-in shell/read/edit permissions are denied while first-party Bostan API tools stay scoped to an authenticated issue/run. This is a safer candidate than the legacy shell-capable adapter.
5. Actual constrained Mac native attempt: runnerd and pinned OpenCode launched, but the assignment run remained at executionStage=preparing (no stdout, stderr, native API invocation, or provider usage result). The bounded source-comment wait expired; the original Case remained draft/implementation. **There was no model execution success and no qualifying review.** The disposable profile was inspected with read-only PostgreSQL (no real user documents). Three exactly identified orphaned QA-native processes were terminated without touching the user's personal OpenCode session.
6. The Mac has only 8 GiB installed RAM and insufficient free RAM for a reproducible native QA + PostgreSQL + bridge stack. Added a *QA-only* host gate: >=12 GiB total RAM, >=6 GiB free RAM, >=8 GiB free TEMP and macOS/Linux. This is **not** a statement about ordinary Bostan user minimum requirements. It fails before allocating test HOME, PostgreSQL, agents or contacting models. Re-run on a resource-qualified host; do not relax limits to fabricate a pass.

## Verification

- Synthetic native/zero-budget/case-receipt/strict same-run handoff/host-gate tests: **18/18 PASS**.
- Full Bostan source Node suite on the amended native driver: **158 PASS, 0 FAIL, 9 Windows-specific SKIP** (167 total).
- Latest-head private macOS Bostan HTTP/PostgreSQL persistence + real Chromium smoke: **PASS**; browserPageErrors 0, blockedExternalRequests 0, clean stop/restart.
- A successful Case receipt string is only emitted when the independent governed Case path actually passes; unlike the previous generic source-agent path, it cannot imply the specialist alone closed the governed task.
- Actual Mac host preflight: **correctly BLOCKED** with enoughTotalMemory,enoughFreeMemory, before any server/model start. Not a live governed Case PASS.
- The original deterministic B5-34 signed Native API/JWT/HTTP/PostgreSQL Case contract remains qualified by 21/21 tests from PR #147, but it does not substitute for model-led report generation.
- The existing B5-33 distinct free-model worker/comment-source readback was qualified previously; its comments are not independent signed Case reports.

## Strict remaining gates

- Complete real independent model-led Case under native permission-denied tool transport on an adequately resourced free QA host.
- Entire official server TypeScript/build on an adequately resourced host.
- Installed Windows distribution and end-to-end QA; Windows host free RAM and staging disk are below its existing conservative QA thresholds.
- Independent comprehensive security review and external-effect consent/observable reconciliation.

No release or public deployment. Current verdict **NO-GO**.
