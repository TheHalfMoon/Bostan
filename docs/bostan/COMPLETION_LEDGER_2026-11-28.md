# Bostan Product Completion Ledger — 2026-11-28

This ledger tracks evidence for approved Bostan scope. Imported features and
green source CI are not, by themselves, product qualification. Statuses below
are a point-in-time snapshot; update them only when new evidence exists.

## Executive status

**Overall: NO-GO / NOT COMPLETE.** PR #584 remains OPEN/DRAFT. Its latest remote head is `dabe465b654de81cb6c8a57dc8c9e7ba1c343b91`.

### Latest native qualification update

Native run [46107218941](https://github.com/TheHalfMoon/Bostan/actions/runs/46107218941), job 140862550776, completed **FAILURE** at 2026-11-28T05:48:32Z. Package creation passed in 14m10s. Ollama archive download, pinned hash verification, model pull (exit 0, child closed), manifest and Apache license checks passed. Installation passed in 165,378ms. Packaged startup reached ready; authenticated private health, first-admin bootstrap, and native agent readiness passed. The first task failed after 47m54s at `first_task_execution` with `heartbeat_not_succeeded`. Graceful app shutdown, disposable profile cleanup and task-owned Ollama cleanup passed. No task completion, attributed comment, persisted result, restart recovery or $0 inference evidence exists.

Run [46115222987](https://github.com/TheHalfMoon/Bostan/actions/runs/46115222987), job 140887415573, completed **FAILURE** at 2026-11-28T07:35:22Z. The server build took 11m09s, standard-user PostgreSQL probe 9m34s, packaging 13m55s, and native qualification 39m08s. The pinned Ollama archive was downloaded and verified; Qwen pull exited 0 in 8 seconds, its child closed, and manifest/license checks passed. Post-pull measurements were 15.99 GiB RAM total, 12.04 GiB free, and 22.11 GiB temp disk free. Packaged startup reached `ready`; private health, first-admin bootstrap, and native-agent readiness passed. The first task failed 5s after readiness with `native_session_interrupted` at `preparing`; the bounded event counts showed no harness-ready, session, turn, or provider events. The run log had 8 JSON records and no recognized safe error signal. Graceful shutdown and disposable-profile/Ollama cleanup passed. This narrows the failure to native-session preparation before a provider session starts; it does not identify the cause. No inference, completed task/comment, restart recovery or cost evidence was produced.

The prior code forwarded the run/resource summary but dropped the structured, redacted `failureDetail` on lifecycle events. Commit `dabe465b654de81cb6c8a57dc8c9e7ba1c343b91` adds allowlisted original source code, recovery mode, provider-session/event/checkpoint booleans, and safe message classification through the PowerShell 5.1 sanitizer. Focused tests passed 30/30; an independent privacy review found no concrete findings. Exact-head native run [46141357687](https://github.com/TheHalfMoon/Bostan/actions/runs/46141357687) and standard CI [46141361633](https://github.com/TheHalfMoon/Bostan/actions/runs/46141361633) are active. Do not launch another qualification until these reach terminal state.

Standard CI [46115227162](https://github.com/TheHalfMoon/Bostan/actions/runs/46115227162) passed all 18 checks on exact PR head `bdec1690`. Completion-ledger CI [46115313898](https://github.com/TheHalfMoon/Bostan/actions/runs/46115313898) passed all 15 checks on commit `cc88c29c`. No real inference, completed task, persisted comment, restart recovery or verified $0 cost is proven.

Focused source changes on this head bind the pinned local Ollama provider into the native agent runtime and preserve separate graceful-shutdown/profile-cleanup receipts. Independent security review found no introduced remote/paid fallback or cleanup-scope issue. PR #584 remains draft; do not merge or publish.

Run `46094352560` verified the 1,618,522,644-byte Ollama archive against pinned SHA-256 `3dd80f6e3a9699f2eadf4ac418f00529cee594df9557541806eda1f1f3f5588a`. Archive download took about 22m11s. Qwen pull exited 0 with closed child, then manifest and Apache license checks passed. The standard-user installer completed in 121,436ms within its 300,000ms budget; registration and signature checks passed. Packaged startup advanced from `importing_server` to `starting_server` to `ready`; authenticated private health and first-admin bootstrap passed. There is no `BOSTAN_PACKAGED_DESKTOP_NATIVE_AGENT_READY_PASS` marker and no emitted task/inference success receipt. The old failure marker's `cleanup` stage was inaccurate; do not infer that cleanup caused the journey failure.

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

The exact-head native run [46086505266](https://github.com/TheHalfMoon/Bostan/actions/runs/46086505266) completed failed at 2026-11-28T01:30:55Z after a 79m56s job. The 1,618,522,644-byte Ollama archive matched its pinned SHA-256 (`3dd80f6e3a9699f2eadf4ac418f00529cee594df9557541806eda1f1f3f5588a`); extraction, executable discovery, version check and loopback readiness passed. Qwen pull exited 0, closed its child, and passed manifest and Apache license verification. The standard-user installer completed in 141,392ms within its 300,000ms budget; registration, signature, packaged app startup through `ready`, authenticated private health and first-admin bootstrap passed. The worker then returned exit code 1 at `installed_app_qualification`; no company, agent, task or inference pass marker was emitted. Its task-owned Ollama cleanup passed. The exact app journey failure code was written to stderr, which the wrapper intentionally does not surface, while the prior allowlist also omitted the QA profile's graceful-shutdown and cleanup receipts. This is an evidence-capture defect, not proof of the underlying application cause. Local fix commit `a5a1f982` adds a bounded stdout failure receipt with allowlisted stage/code and regression coverage. Exact-head native run [46094352560](https://github.com/TheHalfMoon/Bostan/actions/runs/46094352560) has passed server build, the standard-user PostgreSQL probe, UI build and packaging; installed-app local-Qwen qualification is active and has not emitted its terminal receipt. Exact-head standard CI run [46094528231](https://github.com/TheHalfMoon/Bostan/actions/runs/46094528231) passed all 17 standard checks, including Windows, Apple Silicon and Intel macOS installed-app CI. The separate native-agent job remains in progress. The preserved `desktop/dist-unpacked-qa/` remains untracked and untouched.

## Current independent engineering packets

Draft PRs #586 and #587 retain scoped `proxy-addr@2.0.8` and MCP SDK `1.32.0` fixes; their hosted checks passed. Draft PR #588 (`51fb215377c2d0b84e867ab52e76cb7f6a3fa57c`) is based on `main` and CI run 46088685034 passed. Draft PR #589 reports all 15 hosted checks passing. PR #590 at `63e360ba518fd8949e2726e41842409b18d0cbc6` completed all 15 checks in run 46094619058 after restoring OpenAPI `maxLength` metadata alongside the UTF-16 validator. Its earlier chat idle-window failure did not recur; retain it as a single non-reproduced failure, not a proven fix. Independent exact-head dependency review confirms these drafts do not form one integrated lockfile: #587 stacks on #586, while #588 and #590 are separate. The partial NPMScan check of #590 covered 1,598/1,618 packages and found 16 vulnerable exact versions, no license violations, and one install-script flag; high findings include `@azure/msal-node@5.6.0` and `fast-uri@3.1.2`. Runtime reachability remains unproven for individual paths, and build/UI tooling findings should not be described as runtime-exploitable without evidence. Require an integrated lockfile and fresh audit before treating the findings as resolved.
Follow-up PR #590 commit `50eb2b526d0edb587b57e08f080d7e3b06853afc` adds a v3-only `fast-uri@3.1.9` override synchronized across manifests and lockfile, plus Ajv URI-normalization regression coverage. NPMScan reports 3.1.9 clear of known advisories; the pre-fix Ajv graph reproduced the IDN canonicalization failure, while an isolated Ajv 8.20/fast-uri 3.1.9 check passed the canonicalization and ordinary/malformed URI controls. Frozen-lockfile validation and a direct server TypeScript compile passed; full workspace setup/typecheck was blocked by absent linked package dependencies in the isolated worktree. Exact-head hosted run `46103618592` is in progress. The change does not establish current SSRF exploitability through plugin schemas; no network resolver is configured.
Draft PR #591 (`926a7783f2f9ee2720b72598cf7aa54d64bb6d62`) was rebased directly onto `main` because CI is restricted to pull requests targeting `main`. It updates the OpenClaw Bostan API example and announcement preview wordmark, preserves runtime-backed path defaults, and adds a focused OpenClaw config-fields regression test. Hosted run 46093528563 passed all 15 checks, including all server shards. This narrow cleanup does not satisfy the full identity gate. The public Paperclip Notebook entry points to an experimental `notebook.paperclip.app` Paperclip Cloud service and is intentionally not renamed as though it were Bostan; its product/endpoint status needs separate review. Protocol headers, environment-variable names, schemas, session defaults and persistent IDs also retain compatibility strings.
PR #564 has a focused avatar-color fix at `66dccb1f47d2193f39de2e3f4a7588621301682c`: the API keeps the legacy `paperclip-dark` parameter, while exports now use Bostan `#0E1014`; its regression checks the CSS token and actual rendered pixel. It also carries the exact historical NSIS fixture UUID fingerprint exception already reviewed on `main` (`f17db7c1`). All 15 hosted checks passed on the exact head. The same narrow exception has been carried to #568 (`4b6549b0`, secret scan and most jobs passed; server-1/server-3 pending) and #569 (`bdccb816`, secret scan and several jobs passed; others pending). The full-history findings were not broadly ignored: only the pre-existing fixed fingerprint is exempted. A local full-history scan on the partial clone could not fetch one promised Git object, so it is not counted as independent scan evidence.
PR #570 includes CEO Inspector keyboard navigation and `CompanySwitcher` selected-state accessibility fixes through `f78afa8693a61ab8b61bccc8bd4e5f095cb409b8`. Company choices now expose a checked radio state, and an archived current company remains announced in a disabled checked row; the empty archived-only state says “No active organizations.” Focused tests passed 2/2 and token gates are clean. The previous exact-head `b0a7d6d3` CI run `46101062654` passed; new exact-head run `46104093703` is queued. Full B6 accessibility/distribution acceptance remains open.
The Codex Security diff-scan launcher rejected the PR #590 range on both attempted local worktree paths with “Review changes requires a non-bare Git worktree with a resolvable HEAD”; no scan ID or report was created, so no Codex Security scan coverage is claimed. Independent manual review found no concrete semver/API mismatch in the scoped overrides, but the large lockfile graph requires hosted compatibility checks, especially separate Vite 6/8 consumers and native Sharp packaging. None of these PRs is merged.


## Mandatory acceptance gates

| Gate | Status | Evidence and limit |
|---|---|---|
| Hosted source CI | **PRIOR-HEAD PASS** | Run 46115227162 passed 18/18 on `bdec1690`; exact-head run 46141361633 is active for `dabe465b`. |
| Windows installed-app CI | **IN PROGRESS, PRIOR-HEAD PASS** | Earlier exact-head run 46094528231 passed. Current exact-head run 46107222605 has its desktop (windows-latest) package job still in progress. |
| Apple Silicon macOS installed-app CI | **IN PROGRESS, PRIOR-HEAD PASS** | Earlier run 46094528231 passed; current exact-head run 46107222605 desktop (macos-15) job is still active. |
| Intel macOS installed-app CI | **IN PROGRESS, PRIOR-HEAD PASS** | Earlier run 46094528231 passed; current exact-head run 46107222605 desktop (macos-15-intel) job is still active. |
| Native Windows installer plus Ollama archive | **PASS ON EXACT HEAD** | Run 46115222987 downloaded and verified Ollama, pulled Qwen, and verified manifest/license. |
| Clean standard-user install, startup, auth health and first-admin bootstrap | **PASS ON EXACT HEAD** | Run 46115222987 packaged the application, reached `ready`, and passed private health, first-admin bootstrap, and native-agent readiness. |
| Clean first-agent journey through persisted task completion | **FAILED, RETRY ACTIVE** | Run 46115222987 failed during native-session preparation (`native_session_interrupted`), before harness/session/provider events. Run 46141357687 exercises the reviewed structured failure-detail receipt. |
| Real local-model inference and successful task execution | **NOT QUALIFIED** | No provider session started; no inference or completed-task evidence exists. |
| Verified zero-cost execution | **NOT QUALIFIED** | No completed run with real inference and verified provider cost exists. |
| Persisted result, restart and history recovery after real inference | **NOT QUALIFIED** | No real task result has been persisted or recovered after restart. |
| Linux packaged desktop | **NOT TESTED** | No Linux packaged-app or real-agent evidence was established in the current qualification set. |
| Publish/release readiness | **NO-GO** | PR #584 is draft; no release authorization or complete end-to-end evidence. |
| Private-development repository visibility | **BLOCKED** | GitHub repository metadata reports public visibility, while the checked-in PR template requires the repository to remain private. Do not mark that checklist item complete or open another public PR. |

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

PR [#584](https://github.com/TheHalfMoon/Bostan/pull/584) remains **OPEN / DRAFT** at remote head `dabe465b654de81cb6c8a57dc8c9e7ba1c343b91`.

Commits 67c71397 and 7e70fcd3 bind the local Ollama provider to native agent readiness/execution and surface safe shutdown/profile-cleanup receipts. The reviewed configuration is pinned to loopback port 11434 and qwen2.5-coder:1.5b; no paid or remote fallback was added. Focused tests passed 47/47 across script, adapter and server suites; adapter TypeScript check passed. Independent read-only security review found no introduced security issue.

Native run 46115222987 failed during first-task native-session preparation; see the latest native qualification update above. Corrected run 46141357687 is active; no duplicate should be started. Standard run 46115227162 passed 18/18 on prior head `bdec1690`; exact-head standard run 46141361633 is active.

The preserved desktop/dist-unpacked-qa/ remains untouched in the primary checkout. Do not start a duplicate build or qualification run.

## Independent product work

Commit 8db89b829cf75bcc9da8cf670644073c05447cd1 on branch fix/nav-failure-accessible-label-20261128 announces failed runs in collapsed and expanded default/production sidebar navigation. The inbox count is labeled accurately as items needing attention. Focused SidebarNavItem and Sidebar tests passed 48/48; token gates passed; independent accessibility review found no remaining concrete issue. A local UI typecheck was attempted but this isolated checkout lacked workspace dependency links and reported unrelated runner type errors; no changed-file error remained. The branch was pushed, but no PR was opened because the repository reports public visibility and the PR checklist requires private visibility.

Commit `5d450e5bf537eba15c8d46ec152345df821fd89a` on local branch
`fix/dialog-accessibility-20261128` repairs the gateway token-revocation
confirmation: it is named and described for assistive technology, contains
keyboard focus, starts on Cancel, restores focus after dismissal/success, and
stays open during a failed or pending request so the user can retry. The
regression test reproduced the prior dialog gap. Gateway component tests passed
22/22, UI typecheck passed, token and map gates passed, map/catalog tests passed
30/30, and the existing Storybook interaction passed in Edge at desktop and
mobile widths with mocked API responses. Independent review found no concrete
security/accessibility issue. The commit remains isolated and local; no live
gateway or full product acceptance is claimed.

Commit `9c05e54831b2a0caf4804f57d1a567d481effbf7` on local branch
`fix/onboarding-accessibility-20261128` prevents Enter during input-method
composition from creating an organization with partially composed text. The
shared submit predicate honors `isComposing` and legacy key code 229 for plain
Enter and Ctrl/Cmd+Enter. Four regressions reproduced premature company
creation before the fix. Three focused onboarding suites passed 200/200 and the
keyboard subset passed 6/6; UI typecheck, token gates, branding check, map
validation and `git diff --check` passed. Independent review found no concrete
issue. These are simulated keyboard events; live OS input methods and full
product acceptance remain unqualified. The commit remains local and isolated.

Commit `e5539ce14b3d51cfe91ca98a704068a40fa35689` on local branch
`fix/organization-card-keyboard-20261128` separates organization selection from
keyboard actions on a company card. Enter on the menu and rename controls no
longer changes the active organization; a native selection button exposes the
current choice. The pre-fix test reproduced the selection change. Focused UI
tests passed 27/27, UI typecheck and token/map/catalog gates passed, 30 map and
catalog tests passed, and Edge verified keyboard selection at desktop/mobile
widths plus rename and unarchive. Independent review found no concrete issue.

Commit `cf16f0114ad6ace9f2d4e2faa2770db0d2bb778c` on local branch
`fix/interruption-recovery-20261128` corrects the recovery card and compact
summary so queued work is not labeled “Attempt running now.” Two regressions
reproduced the false state before the display-only fix. Recovery suites passed
147/147 plus UI typecheck, token/branding checks and feature-map validation.
Independent review found no concrete issue; exact-run identity, native-resume,
expiry and durable-path predicates were unchanged. No live recovery is claimed.

Commit `b91e1c5ed71d1bd324f101c5191a030c1e29cbf5` on local branch
`fix/test-tool-approval-policy-20261128` rechecks current policy, agent
eligibility, and signed remote tool identity before approving a parked Test-tab
invocation. Only the exact unchanged signed invocation retains its consumed
rate-limit slot. Five focused real-PostgreSQL cases and four nearby approval/
lifecycle cases passed with inert fixture providers; server TypeScript,
feature-map checks, and `git diff --check` passed. Independent read-only review
found no actionable issue. Local stdio target drift and concurrent approval
dispatch remain unverified. The commit is local only; no PR was opened under the
public-repository/private-template governance mismatch.

GitHub repository metadata identifies TheHalfMoon/Bostan as public. This conflicts with the PR template private-repository checklist and remains a governance/release blocker; no repository visibility setting was changed.

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
- Evidence from the Windows native hosted runner is sanitized. Model-pull
  stdout/stderr was captured in a task-owned temporary directory and cleaned up
  after the successful pull. The first-agent failure in run `46094352560` is
  still not localized: the last success marker was first-admin, native-agent-
  ready is absent, and cleanup overwrote the original stage. The diagnostic
  repair at `0d0df042` must pass exact-head qualification before the
  agent-readiness cause can be known.

## Next actions

1. Let exact-head run 46141357687 reach terminal state; do not launch a duplicate. Capture the allowlisted native failure source, recovery fields, resource measurements, process exits and durations.
2. Use that source to fix the actual agent execution boundary. Then qualify real installed-app Qwen inference through persisted task/comment, restart recovery and verified $0 provider cost.
3. Qualify any corrected exact source commit without reusing stale artifacts. Keep PR #584 draft until real inference, persistence, restart and zero-cost acceptance pass.
4. Keep other dependency, ACPX, UI, install/recovery and security packets isolated and follow repository review rules. No merge or public release without all required gates and authorization.
5. Resolve the public-repository/private-checklist governance mismatch before creating additional public PRs; continue local engineering that does not require changing repository visibility.
6. Work through remaining B0–B6 installation, recovery, security, accessibility and live agent/effect acceptance gates. Product completion remains NO-GO.
