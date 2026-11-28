# Bostan Product Completion Ledger — 2026-11-28

This ledger tracks evidence for approved Bostan scope. Imported features and
green source CI are not, by themselves, product qualification. Statuses below
are a point-in-time snapshot; update them only when new evidence exists.

## Executive status

**Overall: NO-GO / NOT COMPLETE.** PR #584 remains draft at `0d0df042e83e1e34e5167dcc20f338cafa812a9a`. Native run `46094352560` completed failed after the model pull, model/license checks, standard-user installation, packaged startup through `ready`, authenticated private health and first-admin bootstrap all passed. It emitted `stage=cleanup code=unclassified`, but the owned-temp cleanup receipt passed. Source inspection found the harness overwrote the original journey failure stage in `finally`; no native-agent-ready marker was emitted, so task execution/inference was not reached. Commit `0d0df042` preserves the first failure stage and adds bounded readiness/shutdown/cleanup categories; 10/10 focused tests pass. Exact-head standard run `46100133830` and native run `46100138186` are queued. No real inference, persisted completion/comment, restart recovery or verified $0 execution is proven.

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
Draft PR #591 (`926a7783f2f9ee2720b72598cf7aa54d64bb6d62`) was rebased directly onto `main` because CI is restricted to pull requests targeting `main`. It updates the OpenClaw Bostan API example and announcement preview wordmark, preserves runtime-backed path defaults, and adds a focused OpenClaw config-fields regression test. Hosted run 46093528563 passed all 15 checks, including all server shards. This narrow cleanup does not satisfy the full identity gate. The public Paperclip Notebook entry points to an experimental `notebook.paperclip.app` Paperclip Cloud service and is intentionally not renamed as though it were Bostan; its product/endpoint status needs separate review. Protocol headers, environment-variable names, schemas, session defaults and persistent IDs also retain compatibility strings.
PR #564 has a focused avatar-color fix at `66dccb1f47d2193f39de2e3f4a7588621301682c`: the API keeps the legacy `paperclip-dark` parameter, while exports now use Bostan `#0E1014`; its regression checks the CSS token and actual rendered pixel. It also carries the exact historical NSIS fixture UUID fingerprint exception already reviewed on `main` (`f17db7c1`). All 15 hosted checks passed on the exact head. The same narrow exception has been carried to #568 (`4b6549b0`, secret scan and most jobs passed; server-1/server-3 pending) and #569 (`bdccb816`, secret scan and several jobs passed; others pending). The full-history findings were not broadly ignored: only the pre-existing fixed fingerprint is exempted. A local full-history scan on the partial clone could not fetch one promised Git object, so it is not counted as independent scan evidence.
PR #570 now includes CEO Inspector keyboard fixes at `7b55336cef8947df417ce0038bacc0f34574ad0f`: one tab stop, Left/Right with wrapping and RTL order, Home/End, and focusable empty/loading panels. Its focused UI test passed 2/2 and UI typecheck passed locally; exact-head hosted run `46099671046` remains queued. This closes only the reported tablist issue, not the full B6 accessibility/distribution gate.
The Codex Security diff-scan launcher rejected the PR #590 range on both attempted local worktree paths with “Review changes requires a non-bare Git worktree with a resolvable HEAD”; no scan ID or report was created, so no Codex Security scan coverage is claimed. Independent manual review found no concrete semver/API mismatch in the scoped overrides, but the large lockfile graph requires hosted compatibility checks, especially separate Vite 6/8 consumers and native Sharp packaging. None of these PRs is merged.


## Mandatory acceptance gates

| Gate | Status | Evidence and limit |
|---|---|---|
| Hosted source CI | **PASS / NEW HEAD QUEUED** | Head `a5a1f982af7062c2112da8fb3526a52e29b30bdf` passed all 17 standard checks in run `46094528231`. Latest diagnostic fix `0d0df042` awaits standard run `46100133830`. |
| Windows installed-app CI | **PASS** | Exact-head run `46094528231` passed the standard-user Windows installed-app workflow. This does not prove real inference. |
| Apple Silicon macOS installed-app CI | **PASS** | Exact-head standard CI run `46094528231` completed the Apple Silicon desktop job successfully. |
| Intel macOS installed-app CI | **PASS** | Exact-head standard CI run `46094528231` completed the Intel desktop job successfully. |
| Native Windows installer plus Ollama archive | **PASS, partial** | Run `46094352560`: pinned archive size/SHA-256, extraction, version, loopback, Qwen pull exit 0, model manifest/license, standard-user installation and signature check passed. |
| Clean standard-user install, startup, auth health and first-admin bootstrap | **PASS, partial** | Run `46094352560` verified installer completion, packaged startup `ready`, authenticated private health and first-admin bootstrap. This does not prove agent readiness. |
| Clean first-agent journey through persisted task completion | **FAIL / RETRY QUEUED** | Run `46094352560` failed before the native-agent-ready receipt. Its `cleanup` stage was overwritten by the harness's `finally`; cleanup itself passed. Commit `0d0df042` fixes first-stage preservation; exact-head native run `46100138186` is queued. |
| Real local-model inference and successful task execution | **NOT REACHED / NOT QUALIFIED** | No native-agent-ready, task completion or real inference receipt was emitted by run `46094352560`. |
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
The previous remote head `4ca245ba` passed all 18 standard hosted checks, while native run `46075821679` failed at Qwen model pull. The native archive integrity, Ollama extraction/version, loopback readiness, server build, PostgreSQL probe and package all passed; installed-app qualification was not reached. Head `7159cc59` replaced the PowerShell 5.1 pull-process wrapper with a bounded Node supervisor. It captures numeric child exit codes, bounds and serializes combined stdout/stderr, emits fixed sanitized categories, uses the owned child process handle for termination, bounds post-exit pipe closure and preserves the task-owned Ollama root if stdio closure cannot be confirmed. Focused tests passed 13/13. Run `46086505266` then qualified archive pull, pinned model/license, installation, packaged app ready, authenticated private health and first-admin bootstrap; the journey then failed before a native-agent-ready marker. Head `a5a1f982` added allowlisted failure receipts but run `46094352560` exposed that `finally` overwrote the earliest failure stage with `cleanup`. Commit `0d0df042` captures the first failing stage before shutdown/cleanup and allows safe readiness/shutdown/temp-cleanup categories; focused tests passed 10/10. Exact-head standard CI `46100133830` and native qualification `46100138186` are queued. The local `desktop/dist-unpacked-qa/` remains preserved and untracked.

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

1. Finish exact-head standard CI `46100133830` and native qualification
   `46100138186`. Use the preserved first failure stage and safe code to locate
   the agent-readiness cause before modifying product behavior or starting
   another native run.
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
