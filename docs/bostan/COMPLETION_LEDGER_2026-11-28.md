# Bostan Product Completion Ledger — 2026-11-28

This ledger tracks evidence for approved Bostan scope. Imported features and
green source CI are not, by themselves, product qualification. Statuses below
are a point-in-time snapshot; update them only when new evidence exists.

## Executive status

**Overall: NO-GO / NOT COMPLETE.** PR #584 is still draft. Its current exact head is `7159cc59641ebf372247793eca8c92f921e1b9da`. The updated native qualification is in progress (run 46086505266) and standard CI is in progress (run 46086509828). Both runs have passed initial setup/integrity work; the native run has reached the server build, and the hosted Windows/macOS build jobs are active. The previous completed head passed source CI but failed during Qwen model pull. Real inference, a persisted installed-app task, restart recovery and zero-cost agent execution remain unproven.

The earlier completed native failure was run [46058240798](https://github.com/TheHalfMoon/Bostan/actions/runs/46058240798), built at parent commit `2f24d925cfe9d297dff28a59cc083c112c790ee5`:

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

The exact-head native rerun is [46058483810](https://github.com/TheHalfMoon/Bostan/actions/runs/46058483810), built from 4bfa89b1. The 62m59s job passed source build, packaging, pinned Ollama archive verification, extraction, version check, and loopback readiness. The packaged native agent step then failed.

At 2026-11-27T22:06:33.891Z, the Qwen pull began. Ten seconds later the child had exited and the old receipt was BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=other childAlive=false outputBytes=7012; the QA worker exited 1. The job cleaned its owned temporary files. The receipt did not include the child exit code or useful error class. Model manifest/license verification, installed-app onboarding, inference, task persistence, comment attribution, restart recovery and cost verification were not reached.

The exact-head qualification runs are native [46075821679](https://github.com/TheHalfMoon/Bostan/actions/runs/46075821679) and standard CI [46075836375](https://github.com/TheHalfMoon/Bostan/actions/runs/46075836375). The native run passed the archive hash probe, server build, standard-user PostgreSQL probe, UI build, package, Ollama archive size/hash verification, extraction, version check and server readiness. Archive download took about 22m32s. The Qwen pull began at `2026-11-27T23:22:03Z` and failed about 15 seconds later. Its sanitized receipt was `BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=other childAlive=false failureClass=process_exit exitCode=unavailable diagnostic=other outputBytes=7612`; the old PowerShell 5.1 process wrapper did not preserve an actual child exit code, and the task-owned raw pull logs were cleaned. No model pull completion, installed-app first-agent journey, real inference, task persistence, restart recovery or zero-cost evidence is available. Standard CI run 46075836375 passed all 18 checks.

The new exact-head runs are native [46086505266](https://github.com/TheHalfMoon/Bostan/actions/runs/46086505266) and standard CI [46086509828](https://github.com/TheHalfMoon/Bostan/actions/runs/46086509828), both on `7159cc59641ebf372247793eca8c92f921e1b9da`. At the latest observation, native archive/runtime qualification and the PS 5.1 standard-user hash probe had passed, the serialized server build had passed, and the standard-user PostgreSQL probe was active; the model-pull step had not started. The standard CI run had passed secret scan, typecheck, gates, the Windows server job, Storybook and most test jobs; Windows/macOS packaging and two test shards remained active. The new native pull supervisor uses the owned Node child handle, captures the actual numeric exit code, caps combined diagnostic output at 1 MiB, reports fixed sanitized categories and retains the task-owned Ollama root if stdio closure cannot be confirmed. Its focused tests pass 13/13; PowerShell 5.1 parsing and `git diff --check` pass. The active exact-head native run has not yet exercised the model-pull step.

## Mandatory acceptance gates

| Gate | Status | Evidence and limit |
|---|---|---|
| Hosted source CI | **PASS on previous head; IN PROGRESS on current head** | Run `46075836375` passed 18/18 on `4ca245ba`. Exact head `7159cc59` is being checked by run `46086509828`. |
| Windows installed-app CI | **PASS on previous head; IN PROGRESS on current head** | Run `46075836375` passed its Windows installed-app job. Run `46086509828` is packaging Windows desktop before the standard-user installed-app workflow. These checks do not prove real inference. |
| Apple Silicon macOS installed-app CI | **PASS on previous head; IN PROGRESS on current head** | Run `46058489615`, `desktop (macos-15)` passed (25m21s). On current head, the macOS desktop jobs are rebuilding. |
| Intel macOS installed-app CI | **PASS on previous head; IN PROGRESS on current head** | Run `46058489615`, `desktop (macos-15-intel)` passed (33m12s). On current head, the macOS desktop jobs are rebuilding. |
| Native Windows installer plus Ollama archive | **PASS, partial** | Run `46058483810`: package and archive pin, size, hash, extraction, version and loopback readiness passed. Qwen pull failed before installed-app first-agent qualification. |
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
The previous remote head `4ca245ba` passed all 18 standard hosted checks, while native run `46075821679` failed at Qwen model pull. The native archive integrity, Ollama extraction/version, loopback readiness, server build, PostgreSQL probe and package all passed; installed-app qualification was not reached. Current PR head `7159cc59` replaces the PowerShell 5.1 pull-process wrapper with a bounded Node supervisor. It captures numeric child exit codes, bounds and serializes combined stdout/stderr, emits fixed diagnostic categories, uses the owned child process handle for termination, bounds post-exit pipe closure and preserves the task-owned Ollama root if cleanup is uncertain. Focused tests pass 13/13, Windows PowerShell 5.1 parser/probe pass, and `git diff --check` passes. Exact-head native and standard CI runs `46086505266` and `46086509828` are in progress. The local `desktop/dist-unpacked-qa/` directory is preserved and untracked.

Independent review confirmed that the signed-exit-code filter could previously
drop valid Windows termination codes; `4bfa89b1` widens the allowlist with a
regression test. This is a supported mechanism for missing receipts, not proof
that it caused the particular `cause=other` failure above.

A second independent review found no critical defect in the bounded diagnostics
and prompted an exact 1 MiB combined-stream fixture, now covered by the probe.

## Tooling and evidence limits

A dependency audit of PR #584 head 4bfa89b137d2268102414460c03d4ddf227b813a
found 37 packages with known vulnerabilities. It checked 1,597 of 1,617
third-party packages; coverage is partial. Examples include critical
proxy-addr 2.0.7, high-severity @modelcontextprotocol/sdk 1.31.0, and
vulnerable undici versions across several dependency paths. The audit found
zero license violations and one install-script flag. Findings still need
package-path and runtime reachability review before changing dependency
resolutions or declaring affected code reachable.

The isolated security branch `security/dependency-triage-20261128` has commit
`aa2fbd5` with the focused `proxy-addr@2.0.8` fix and is published as draft
PR #586; all 15 hosted checks pass. Sibling branch
`security/mcp-sdk-update-20261128` has commit `745369b0` adding the
`@modelcontextprotocol/sdk@1.32.0` override and is published as draft PR #587.
NPMScan reports four advisories (two high and two moderate) on 1.31.0 and none
on 1.32.0. The affected MCP server suites passed 53 tests and all three package
typechecks passed; frozen-lockfile installation passed. PR #587 hosted CI run
46081294978 passed all 15 checks.

Draft PR [#588](https://github.com/TheHalfMoon/Bostan/pull/588) targets `main`
independently, so its checks cover only the Undici/Cursor change and do not
bundle #586 or #587. It patches remaining Undici 5/6/7/8 paths and upgrades the
Cursor Cloud SDK from 1.0.28 to 1.5.2. NPMScan exact-version checks reported zero advisories for
undici 6.29.1, 7.30.1, 8.14.0 and @cursor/sdk 1.5.2. Upgrade simulations
reported fixed vulnerability deltas for the three Undici lines, no tightened
Node engine requirements and no new SDK lifecycle script. A full-workspace
frozen lockfile-only install passes. The isolated worktree did not have
workspace package links, so its adapter typecheck remains unverified; hosted
CI must validate that API and the cross-platform lockfile. PR #588 CI run
46088685034 was queued on head `51fb215377c2d0b84e867ab52e76cb7f6a3fa57c`
at the latest check. The advisory D1 review returned low risk at low
confidence; that output is not security approval because the model is known to
miss severe issues.

Read-only product reviews on 4ca245ba found no authorization bypass in the
inspected ACPX approval and Paperclip tool-authority paths. They did find that
ACPX `approve-reads` and `approve-paperclip` options are advertised for every
provider, while automatic exact-tool rules are installed only for Claude;
other providers escalate requests, which fails closed but differs from the
advertised behavior. The reviews also identified remaining gates: installed
local-model task completion and restart recovery; standalone Windows/macOS
upgrade, backup, restore and rollback; real PostgreSQL force-crash/orphan
recovery; recovery for missing runtime artifacts; and live multi-agent effect
reconciliation, independent verification, interruption and consent/budget
fence tests.

Local branch `fix/acpx-permission-mode-parity-20261128` has commit
`cafe36f2` clarifying that automatic ACPX read/action rules apply to Claude,
while other providers use an approval flow when configured and fail closed
without one. Its focused permission catalog suite passed 45 tests and the
adapter-utils typecheck passed. An independent reviewer confirmed the wording
matches the inspected runtime and caught a duplicate test before the commit was
amended. This UX correction does not add permission parity to other providers.

- The available D1 local review is advisory only and warns that its small model
  can miss severe security issues. It is not used to satisfy any release or
  security gate.
- No Alibaba local code-review or PStack runtime/tool was available in this
  environment; no result from either is claimed.
- The Codex Security workbench timed out after 300 seconds while enumerating
  both the clean whole-repository worktree and the narrower `server/src` scope.
  It returned no scan ID or findings; this is unavailable audit coverage, not
  a clean security result.
- Evidence from the Windows native hosted runner is sanitized. Raw model-pull
  stdout/stderr was kept in the task-owned temporary directory and cleaned up;
  the current failure receipt is insufficient to identify the exact model-pull
  error. The exact-head rerun must produce a useful bounded category/exit-state
  receipt before further root-cause work is considered complete.

## Next actions

1. Finish the active exact-head native and standard CI runs. If Qwen pull fails,
   use the newly captured numeric exit and bounded category to isolate its
   cause before changing the workflow or retrying.
2. Complete actual local Qwen inference through the installed application;
   verify persisted task/comment, restart recovery and zero provider cost.
3. Run and review PR #588 CI and Cursor adapter compatibility checks; keep it
   draft unless all required CI and independent review gates pass.
4. Keep PRs #586 and #587 draft until repository review requirements are met;
   both now have passing hosted checks. Continue package-path and runtime
   compatibility review for remaining dependency findings.
5. Keep the ACPX permissions clarification separate from #584 and decide
   whether to implement provider-specific safe automatic rules after validating
   each provider protocol and adding behavior tests.
6. Work through remaining B0–B6 installation, recovery, security, accessibility
   and live agent/effect acceptance gates. Keep PR #584 draft and update this
   ledger only when evidence changes.
