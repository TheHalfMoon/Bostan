# Bostan Product Completion Ledger — 2026-11-28

This ledger tracks evidence for approved Bostan scope. Imported features and
green source CI are not, by themselves, product qualification. Statuses below
are a point-in-time snapshot; update them only when new evidence exists.

## Executive status

**Overall: NO-GO / NOT COMPLETE.** The installed application has passed the
current Windows, Apple Silicon macOS, and Intel macOS desktop CI lanes at PR
#584 head `4bfa89b137d2268102414460c03d4ddf227b813a`, and all 18 hosted CI
checks passed. The native Windows first-agent qualification failed during the
Qwen model pull before that model download completed, manifest verification,
or inference. A rerun at the exact PR head is in progress.
No real inference, zero-cost agent execution, or release readiness is proven.

The latest completed native failure was run [46058240798](https://github.com/TheHalfMoon/Bostan/actions/runs/46058240798), built at parent commit `2f24d925cfe9d297dff28a59cc083c112c790ee5`:

- Pinned Ollama archive size and SHA-256 matched; safe extraction found one
  executable, the expected version ran, and the loopback Ollama server became
  ready.
- Model pull started at `2026-11-27T21:03:29Z` and failed at
  `2026-11-27T21:03:44Z`.
- Sanitized receipt: `BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE
  cause=other childAlive=false outputBytes=7478`.
- Task-owned temporary cleanup passed. No model manifest/license, installed
  verification, installed native-agent journey, persisted task, attributed
  comment, restart recovery, or cost result was reached.
- This receipt does not expose an exit code or useful failure category. It does
  not establish the model-pull root cause.

The exact-head native rerun is [46058483810](https://github.com/TheHalfMoon/Bostan/actions/runs/46058483810).
Installer packaging has passed; the run is in its packaged Windows native
agent/model qualification step. Do not start another native build while this
run progresses.

## Mandatory acceptance gates

| Gate | Status | Evidence and limit |
|---|---|---|
| Hosted source CI | **PASS** | PR #584 head `4bfa89b1`; 18/18 checks passed, including typecheck, test shards, gates, secret scan, Storybook, and Windows server tests. |
| Windows installed-app CI | **PASS** | Run `46058489615`, desktop Windows job passed (46m37s). This establishes the job's installer acceptance, not real model inference. |
| Apple Silicon macOS installed-app CI | **PASS** | Run `46058489615`, `desktop (macos-15)` passed (25m21s). |
| Intel macOS installed-app CI | **PASS** | Run `46058489615`, `desktop (macos-15-intel)` passed (33m12s). |
| Native Windows installer plus Ollama archive | **PASS, partial** | Run `46058240798`: installer packaging passed; archive pin, size, hash, extraction, version, and Ollama readiness passed. Native first-agent qualification did not pass. |
| Clean standard-user install, onboarding, workspace and agent creation in a native local-model journey | **NOT QUALIFIED** | The model pull failed before installed-app qualification. |
| Real local-model inference and successful task execution | **FAIL / NOT QUALIFIED** | No inference or successful agent task was reached in the latest completed native run. |
| Verified zero-cost execution | **NOT QUALIFIED** | There is no completed run with real local inference and verified provider cost. |
| Persisted result, restart and history recovery after real inference | **NOT QUALIFIED** | Not reached. Separate packaged startup/restart tests are not agent-task recovery evidence. |
| Linux packaged desktop | **NOT TESTED** | No Linux packaged-app or real-agent evidence was established in the current qualification set. |
| Publish/release readiness | **NO-GO** | PR #584 is draft; no release authorization or complete end-to-end evidence. |

## Approved roadmap work remaining

The current source of feature scope is [`ROADMAP.md`](../../ROADMAP.md), with
the detailed V1 contract in [`SPEC-implementation.md`](../../doc/SPEC-implementation.md).
The roadmap explicitly retains these unfinished requirements:

| Roadmap area | Status | Remaining acceptance |
|---|---|---|
| B0 — Foundation, source runtime, product identity | **IN PROGRESS** | Re-run native Windows UTF-8 first-agent CLI acceptance and verify repeated clean termination; finish Bostan identity migration across visible UI, package metadata, docs, binary, installer and runtime while preserving legal notices; qualify minimal standalone Windows/macOS install/start/stop/upgrade/backup/restore/rollback; finish feedback/export on Windows and browser/consumer E2E plus cross-platform safety acceptance; qualify private Cloud broker using an operator-owned service; complete dependency, license, privacy and security qualification. |
| B1 — Reliable company orchestration | **PARTIAL** | Stress independent finalization, revocation and external-effect verification with multiple live agents and adverse scheduling; cover governed creation paths, concurrent lease recovery, cross-tenant policy, output verification, recovery and budget gates. |
| B2 — Decision Fabric | **PARTIAL** | Real Chromium board-review E2E; independent citation relevance/readback; actual board-defined budget limits; calibrated outcomes; external evidence proof/readback; durable model routing and evaluations. |
| B3 — Action Fabric | **PARTIAL** | External provider/browser readback and signed independent verifier evidence; cross-key duplicate reconciliation; unknown-outcome reconciliation and fail-closed retries; real computer/browser connector E2E with revocation, recovery and effect verification. |
| B4 — Knowledge and Analytics | **PARTIAL** | General scoped search/OCR; cross-source citation quality; provenance through revision conflicts; external-cache deletion propagation; injection-resistant agents; reproducible analytics. |
| B5 — Autonomous company acceptance | **PARTIAL** | Real authorized founder-to-specialist agent-run delegation; independent effect readback and verifier sign-off; evidence-backed founder summary; duplicate-effect, interruption, recovery, budget and consent-fence scenarios. Existing synthetic native integration receipts are not real model/effect qualification. |
| B6 — Distribution readiness | **NOT QUALIFIED** | Finish branding/onboarding/accessibility, secure defaults, portable installers, SBOM/notices, independent E2E and security receipts. Publication/deployment remains prohibited without explicit instruction. |

## Engineering packet in progress

PR [#584](https://github.com/TheHalfMoon/Bostan/pull/584) remains **OPEN / DRAFT**.
The remote head `4bfa89b1` has 18/18 hosted CI checks passing. Local commit
`2f7e01542012fc5da65248e8c7271fea64388048` improves classification precedence
when model-pull logs exceed the 1 MiB cap; its focused tests pass 6/6 and the
PowerShell 5.1 parser passes. It is not yet pushed because native runs are
progressing serially. The local `desktop/dist-unpacked-qa/` directory is
preserved and untracked.

Independent review confirmed that the signed-exit-code filter could previously
drop valid Windows termination codes; `4bfa89b1` widens the allowlist with a
regression test. This is a supported mechanism for missing receipts, not proof
that it caused the particular `cause=other` failure above.

## Tooling and evidence limits

- The available D1 local review is advisory only and warns that its small model
  can miss severe security issues. It is not used to satisfy any release or
  security gate.
- No Alibaba local code-review or PStack runtime/tool was available in this
  environment; no result from either is claimed.
- Evidence from the Windows native hosted runner is sanitized. Raw model-pull
  stdout/stderr was kept in the task-owned temporary directory and cleaned up;
  the current failure receipt is insufficient to identify the exact model-pull
  error. The exact-head rerun must produce a useful bounded category/exit-state
  receipt before further root-cause work is considered complete.

## Next actions

1. Let native run `46058483810` finish; inspect its terminal receipts and
   installed-app result before changing or starting another qualification.
2. Improve model-pull diagnostics so a completed child reports a bounded exit
   status plus sanitized classification on every failure path. Keep raw logs
   private and capped; ensure cleanup still runs.
3. Once the current run reaches terminal state, push the reviewed local cap
   fix and qualify the resulting necessary head without overlapping runs.
4. Complete actual local Qwen inference through the installed application,
   verify persisted task/comment, restart recovery and zero provider cost.
5. Work through the remaining B0–B6 roadmap gates and update this ledger only
   when corresponding evidence is available.
