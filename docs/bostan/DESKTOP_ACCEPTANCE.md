# Desktop acceptance and continuation

Date: 2026-11-10. Product status: **not release-qualified**. No release, tag,
deployment, signing or notarization has been performed.

## Source and active work

- Last verified main: `c838939bb5f3d6cf38bd79b264809025b6402a4a`, 15 CI jobs passed.
- PR #540 (`work/compiled-server-qualification`), head `9ca0b1e8`: fixes missing
  database JavaScript assets, adds a real compiled Windows API journey, and
  runs it under a fresh standard Windows CI user. Full final-head CI pending.
- PR #542 (`work/desktop-runtime`): Electron desktop, production dependency
  staging, unsigned packaging and installed Windows qualification. It includes
  #540 until that parent is merged. Full artifact CI pending.
- PR #541 is separate active work on inherited install guidance; do not duplicate it.

## Evidence actually executed

| Gate | Result |
| --- | --- |
| Windows desktop unit/policy/NTFS/relocation/port tests | 9 passed |
| Native Electron 45.2.3 host regressions | 3 passed |
| Embedded Node version from actual Electron executable | 24.22.2 |
| Desktop dependency audit, pinned lockfile | 0 reported vulnerabilities |
| Independent correctness/product and security review | initial findings fixed; delta reviews pass |
| Workflow publication quarantine | passed locally |
| Complete hosted Windows server/dependency/Rust build | passed, then runtime qualification failed as described below |
| Actual NSIS construction/install/onboarding/restart/uninstall | not yet executed |
| macOS DMG construction | CI built a candidate, then packaging cleanup failed; no accepted artifact |
| macOS installed-app launch/data lifecycle | guarded DMG install/onboarding/restart/uninstall journey implemented; native evidence pending |
| Live model execution, update/rollback, full network capture | unqualified |

The native host fixtures prove compiled workspace exports, an actual embedded
Node subprocess, quit during startup, cross-origin redirect cancellation before
the target is requested, and a visible window/retry after rejected shutdown.
They use synthetic backend code; they do not prove real PostgreSQL or a real
agent run. The data-directory test exercises Windows ACL changes and repeated
launch on disposable directories without elevation.

## Failures preserved

The first desktop CI failed before packaging: npm withheld Electron's download
hook on macOS, and the Windows ACL helper exceeded its existing 15-second bound.
CI now invokes the pinned Electron installer explicitly, and ACL verification
uses the direct .NET API without PowerShell module autoload. The timeout remains
unchanged. A local host rerun also exposed Chromium's rejection of OS-assigned
port 6000. The desktop and redirect fixture now select free high loopback ports;
the real redirect test remains intact. Nine unit and three native Electron tests
passed afterward. Fresh hosted artifact qualification is still required.

The initial full Windows build failed on CRLF-altered protocol fixtures. Checkout
now disables conversion before reading the hashed sources. The next build
passed, but compiled startup missed three `.mjs` database helpers; the database
build now copies their unchanged bytes, with source-removal regression coverage.
The next compiled startup loaded the module graph but PostgreSQL refused the
elevated GitHub runner token. The new CI launcher uses a separate standard user
and retains PostgreSQL's administrator protection. That launch still needs its
first hosted pass; operator-PC refusal is independently tested.

Local diagnostic-only server emission is not a qualified build. A diagnostic
attempt failed on absent local compiled migration assets, and its retained
fixture was removed only after independent zero-PostgreSQL proof. Do not reuse
those diagnostic server outputs as final acceptance evidence.

## Reproduce and continue

```sh
npm --prefix desktop ci
npm --prefix desktop test
npm --prefix desktop run test:host
pnpm --filter @bostan/server... --workspace-concurrency=1 build
pnpm --filter @bostan/ui build
npm --prefix desktop run package
```

Full builds should run serially on a host with adequate available RAM. This
operator PC fluctuated below 1 GiB free; heavyweight qualification uses hosted
CI. `scripts/bostan-ci-windows-user.ps1` refuses operator PCs and is for an
explicit disposable GitHub Windows runner only. Its Server mode runs the real
compiled auth/claim/tenant journey; Installer mode runs the prepared Windows
artifact test under a new standard user with its own profile.

Next: follow final-head CI for #540 and repair actual failures. Review and merge
only after all required checks pass, verify main, then requalify #542 on the
updated main. Windows installer acceptance must check executable/registry removal
before claiming data-retaining uninstall. Mac build-only evidence cannot satisfy
installed macOS lifecycle acceptance. Artifacts remain unsigned and unpublished;
OS signing/notarization and public release require explicit owner authorization.

## 2026-11-11 packaging repair — native rerun pending

Run `42927771728` at `b8c362f2` failed both desktop jobs. Windows still
exceeded the 15-second ACL helper bound. Mac constructed a DMG but then rejected
the temporary stage's identity; it also warned about an unused static
`desktop/runtime` resource. A built DMG and a warning do not establish that its
copied backend was complete. No installer acceptance is claimed from that run.

Packaging now owns a separate canonical temporary container outside the build
output, with a deploy-owned child that may be recreated. Cleanup checks the
container's original identity. A dynamic resource entry replaces the unused
static resource entry. The `afterPack` gate compares every runtime file's hash,
portable link target and executable flag against the verified stage, rejecting
missing, added or modified payloads before accepting an installer.

Independent review found a second Windows closure defect: the actual builder
copy routine drops empty directories after junction serialization, including
scoped dependency parents. Generated directory markers preserve those parents
and empty physical link targets; strict restoration checks remain intact. The
regression uses the installed builder's own copier, removes the source stage,
verifies the copied payload, restores scoped dependencies and loads one through
Node resolution. It also exercises an empty link target.

Local Windows tests: 19 passed, with the POSIX executable-bit case skipped on
Windows. The final packaging-runtime rerun passed six cases with that same skip.
Independent correctness/product/parsimony and security reviews passed after the
directory-preservation fix. These are unit/copy-boundary checks, not an installed
Mac or Windows application journey.

The Windows timeout's cause remains unknown. Fixed enum-only phase diagnostics
now distinguish where it stalled without exposing paths or changing the ACL,
timeout or concise user-facing failure message. Native hosted qualification is
still required, including an actual Mac installed-app lifecycle. Signing,
notarization and publication remain disabled.

## 2026-11-11 second native failure and targeted repair

Run `42968075324` at `55abeb6b` failed both desktop jobs again. Windows
reported `timeout` at `identity_ready`, before `policy_ready`; the earlier
statement about avoiding module autoload was incomplete because `New-Object`
still performed command discovery. ACL objects now use direct .NET constructors
throughout, retaining the same policy, verification and 15-second bound. Local
Windows tests again pass 19 cases with one POSIX executable-bit skip. Native
hosted success remains required; the diagnostic does not establish the timeout's
complete root cause.

Mac failed before building an installer: pnpm 9 attempted to create
`/Users/private` while linking bins for a stage under the canonical OS temporary
directory. The stage now lives inside the workspace, under `desktop`, outside
the builder output tree. It still has an independently owned container and the
same identity-checked cleanup. Generated stages are ignored by Git and excluded
from the app's explicit file allowlist. A minimal zero-network workspace deploy
fixture passed for both internal and external stages on Windows; this does not
reproduce or close the macOS-specific failure. Full native CI must validate the
actual production deploy and packaged payload.

## 2026-11-11 installed macOS qualification implementation

The macOS desktop job now mounts the generated DMG read-only, verifies its
checksum, copies its application to the disposable runner's per-user
Applications directory, detaches the DMG, and launches that installed copy.
It drives the same real onboarding and persistent-session/agent checks as
Windows, proves PostgreSQL stops after each close, then removes only the owned
application bundle and verifies application data survives. Cleanup checks
canonical paths, directory identities and a test-created data marker. Existing
installations, data (including dangling links), non-hosted runners and operator
machines are refused. Failed runs retain evidence rather than deleting state.

The platform-independent UI journey is shared with Windows; existing assertions
remain and both API response statuses plus reopened-page errors are checked.
These tests defer provider setup, so neither success nor implementation proves
real model execution, full network silence, OS trust, or update/rollback.
Local Windows desktop tests: 21 PASS / 1 POSIX-only SKIP, including both
operator-environment refusal guards. Workflow quarantine PASS. Actual installed
Windows/macOS execution remains pending hosted CI.

## 2026-11-11 ACL completion diagnostic

Run `42971413083` at `ccc2b4ff` failed the Windows ACL helper again under the
unchanged 15-second bound, but reached `verified`. Direct constructors therefore
allowed policy construction, application and verification to complete. The
remaining `Write-Output` statement still invoked command discovery after that
marker; it now uses `[Console]::Out.WriteLine` as well. Native success is still
required; reaching the marker alone is not startup or installed-app acceptance.

The same run's macOS job completed production staging and reached afterPack,
where exact runtime equality failed. The stage-placement change therefore
advanced past the previous pnpm failure, but no installer was accepted. The
comparison remains strict; bounded build diagnostics now identify missing,
unexpected or changed relative package paths and the differing field names,
without printing payload contents, link destinations or absolute local paths.
The native Windows compiled-server lane still reports the separately owned
PostgreSQL chmod blocker, and server-4 reported one login-cleanup assertion
failure. Those are preserved as distinct qualification failures.

## 2026-11-11 production dependency copy correction

Run `43030893239` at `1b31617d` reached Mac afterPack and reported 58,249 missing
runtime entries, starting with dependency executables. The installed builder's
`util/filter.js` unconditionally rejects a copy source's root `node_modules`;
the earlier raw `copyDir` test did not exercise that filter. Packaging now gives
the verified production dependency graph its own extra-resource source entry.
New regressions use the actual `getFileMatchers` and `copyFiles`: they reproduce
the omission under the old mapping, then require exact payload equality and
load a nested dependency under both resource layouts with the corrected mapping.
Strict runtime closure validation remains unchanged; native artifact acceptance
still requires a fresh successful run.

The next run `43034666672` at `97ff8a77` reached afterPack on both native
platforms. The only remaining differences were two Undici `.gitkeep` files.
The installed `builder-util` walker always skips `.gitkeep` and `.DS_Store`.
Verified regular files with those names now receive explicit file mappings;
their bytes are preserved rather than removed or ignored. Mappings reject
traversal, absolute paths and nonportable separators. The real matcher/copy
regressions include nonempty metadata files so omission cannot pass unnoticed.
No installer acceptance is claimed until exact runtime equality and the actual
installed lifecycle both pass.
# Native installer continuation, 2026-11-11

At head 61c05af50ef8818e1333cb1e299eebe7acf99527, run 43039500940 passed both native package builders and exact runtime resource comparisons. Windows installed qualification then failed at the existing 120-second NSIS installation bound (job 130587412100); no onboarding or uninstall acceptance was established. macOS installed qualification emitted no progress before the workflow's 60-minute job budget canceled it (job 130587412492). Runner cleanup reaped Electron/helper processes; this does not prove clean application shutdown. The separate compiled Windows lane still reported PostgreSQL chmod EPERM.

The next diagnostic delta preserves timeouts, assertions and cleanup policy. It records bounded path-free extraction facts when Windows installation fails, and fixed macOS mount/install/launch/page/close phases with elapsed time. These observations are intended to discriminate the actual failure; they do not establish a fix. Local desktop suite remains 24 PASS / 1 Windows skip for POSIX executable-bit semantics, diff check PASS. Independent fresh diagnostic review found no must-fix findings; its verification-marker ordering suggestion was applied. Native rerun remains required.

## Compiled correction integration, 2026-11-11

PR #543 at dc6e703d982793a5051bf29d8630d295b127935c passed all 15 exact-head jobs in run 43049933675, including its compiled Windows startup and shutdown journey. Its explicit integration gate remains respected: do not merge that stacked PR directly. The desktop baseline 01db913ba6fbda138f3f51f7f1d539c4355c351d already contains parent #540 at 9ca0b1e84ab01bead0d38daa4ed4cabfa100de21. A conflict-free merge therefore adds only seven correction files, preserving ancestry without duplicating the parent implementation. The other engineer's checkout is untouched.

Those corrections add the Windows-only POSIX chmod skip to the pinned PostgreSQL patch, preserve strict listener ownership through a bounded OS-query fallback, and require independent orphan proof after server-first cleanup even for absent/stale PostgreSQL markers. Fresh correctness/parsimony/product and security reviews passed; the patch hash was independently checked against the lockfile. The first local focused run had 19 PASS / 1 FAIL because a test required stale exact patch-hunk line counts. Its assertion now verifies placement in the executable permission helper, and all 20 focused tests PASS. Production corrections remain byte-identical to the qualified #543 files. Current installed-desktop failures and native rerun requirements remain open; this reconciliation does not establish installer or release acceptance.

## Installed-phase bounds and NSIS receipts, 2026-11-11

Run 43083446721 at 01db913b again failed Windows installation at the unchanged 120-second bound. The new failure snapshot recorded no application executable and zero entries in the destination. This does not distinguish installer initialization from extraction into a temporary plugin directory. Optional NSIS pre-init, multi-user-ready and install-complete receipts now provide that next discriminator, without changing installation/elevation policy or its deadline. Only an explicitly selected QA process writes fixed labels to its caller-created temporary file; diagnostic input uses a fixed 2,049-byte descriptor read and enum filtering.

The existing pinned builder's checksum-verified NSIS 3.0.4.1 compiler compiled and executed an isolated phase-only stub on native Windows. Disabled writes, all three enabled receipts and incoming error-flag preservation PASS. The first fixture compile failed because its include used non-native path separators; that fixture was corrected. The first enabled receipt run then exposed NSIS append mode overwriting prior phases; FileSeek END corrected it and the final run passed. These retained failures concern the diagnostic fixture/hook, not successful application installation.

Electron data-path inspection and first-window waits now have host deadlines of 180 seconds, with close bounded at 90 seconds. A timed-out phase fails qualification and stops only the captured QA application's ChildProcess; it cannot become a clean-shutdown or successful-install receipt. Independent PostgreSQL checks still execute when close or image detach fails. Real child/sentinel tests prove timeout termination stays scoped and successful calls cancel their timers. Desktop suite: 27 PASS / 1 POSIX-only Windows SKIP. Fresh correctness/parsimony/product and security reviews PASS for both bounds and NSIS deltas. Native full-application installer/lifecycle rerun remains required.

## Source-agent integration, 2026-11-11

The desktop candidate also incorporates source candidate 45135ef3131140e81d5d759a9acab7abc6fc7f7d (#552, including #551) and its already-landed main ancestry. All 48 imported non-workflow files were compared byte-for-byte with that reviewed source candidate. The sole workflow conflict was resolved by preserving every desktop/compiled Windows job and adding only the three source preflight/SDK/long-path steps. Independent resolution review passed; local workflow admission/quarantine tests remain 23 PASS. Full candidate CI remains required.

At that exact clean source head, local Qwen2.5 1.5B with 8,192-token context completed a genuine assigned text task: authenticated synthetic setup, real provider verification, automatic assignment wake, persisted run, exact model-text JSONL response, and board acceptance to done. A second owned run then restarted the source server with the same configured synthetic auth secret on a new loopback port; the original session, company, agent, accepted task and actual model result survived. All 21 checks passed and both owned database stops succeeded. This is source-server/legacy-adapter evidence, not installed-desktop, tool/artifact, unfinished-run recovery, full privacy/network or release acceptance. Earlier empty company-heartbeat output remains an unsuccessful marker test. Qwen2.5 3B passed direct adapter text execution but failed automatic hello verification and remains unqualified.

## Startup diagnosis continuation, 2026-11-12

The complete macOS log for run 43083446721 distinguishes installation from backend startup: mount completed at 19:48:32 UTC, installed copy at 19:49:20, Electron connected and the first window appeared at 19:49:23. The page never reached the loopback backend within 180 seconds. Failure cleanup began at 19:52:24 and blocked in application close until the job was canceled at 20:21:41. Runner process reaping is not clean shutdown. This narrows the failing stage but does not identify its backend cause.

The application now emits only fixed startup phase and allowlisted error-code receipts; raw backend errors remain hidden. Installed QA observes complete allowlisted lines from its captured child, reconstructs fragmented lines within 256 characters, and discards arbitrary or oversized output. Observers detach after page readiness or before close. Output emitted before observation attaches may be absent; receipts are diagnostic evidence only and cannot relax any lifecycle assertion. The existing forced-close bounds still mark failure. The desktop suite passes 30 tests with one POSIX-only skip on Windows; actual installed acceptance remains pending.

Main 65cd014a26e79aff3dd889681b81594d6e0aecc7 passed all 15 post-merge jobs in run 43125236342. Its ancestry was reconciled into the desktop candidate without changing the existing candidate tree. Desktop run 43095845484 remained queued with no jobs at the time of this update; its queue cause is unknown.
