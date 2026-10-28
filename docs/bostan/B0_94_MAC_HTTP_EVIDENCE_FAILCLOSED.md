# B0-94 — Fail-closed macOS authenticated HTTP evidence

2026-10-28. Private stacked engineering on top of B0-93 Draft PR #245. Never merge to main or release.

## The defect

During B0-93 macOS localhost testing, seven genuine success lines were emitted (PostgreSQL migrated, private authenticated health, synthetic signup, first-admin claim, post-claim ready, HTTP shutdown and PostgreSQL cleanup). The original parent process nevertheless waited until its 110-second subprocess timeout because an imported child tool held a stdout pipe open. The first script mistakenly reported a passing result even with a timeout. PR #245 introduced file-backed stdio and exit-status checks. A follow-up source audit found that the parent still identified stage completion using loose substring matches (`output.includes(stage+"\\n")`) without enforcing **uniqueness, exact-line matches, or stage ordering**. In principle text elsewhere in the log could spoof a marker, and an unexpected order could go unnoticed.

## B0-94 engineering

- Added zero-dependency `scripts/bostan-private-mac-http-evidence.mjs`, a pure evaluator of the actual child status, signal, error code, capped log bytes and complete log contents.
- A qualification now requires: actual exit **0**, **no signal**, **no child error/timeout**, at most 2 MiB log data, **exactly one** occurrence of each required marker as a complete line, markers in their required causal order, and **no explicit child failure marker**.
- Outputs bounded stage booleans and stable reason codes. Does **not** copy connection strings, logs, credentials or stack traces into the receipt. Supports CRLF and LF.
- The B0-93 macOS parent invokes the evaluator; `macAuthenticatedHttpQualified` is true only after the evaluator passes **and** the owned temporary test fixture is removed successfully. Uncertain/failed probes preserve their fixture for owned-process inspection, rather than deleting a PostgreSQL data directory while a child might still be alive. The existing 110-second bounded spawn and file-backed child stdio remain.
- Updated the prior B0-93 source-level safety test to assert use of the evaluator and post-cleanup success predicate.

## Verification and limits

New pure evaluator test suite: **7/7 PASS, 0 fail, 0 skip** on local Node **22.16.0** (Linux container); cases cover exact ordered markers, missing/duplicate/reordered markers, prefixed/suffixed/colored spoof lines, nonzero exit, timeout, SIGTERM, failure marker, oversized/non-numeric logs, redacted summaries, and CRLF. These tests require no Bostan dependencies, database, paid model, or remote computer.

**NOT YET VERIFIED:** the modified GitHub-integrated macOS harness has not been run on native Mac after these changes. The user-authorized Desktop Commander connection hit its monthly quota; do not retry/reconnect to evade that limit. Node22 unit success is **not** macOS end-to-end qualification. The prior B0-93 manual native Mac real HTTP signup/claim and PostgreSQL teardown already passed, but exact B0-94 head requires its own rerun. Windows C: was about 0.323 GiB free, so B0-91's 2 GiB native system-disk guard remains necessary before any heavy Windows run.

## Native retake (only once access and headroom return)

In a **fresh owned private** `/private/tmp/bostan-b094` checkout at this PR exact head, Node >=24.11 and locked pnpm, with frozen `@bostan/server...` dependencies and the required internal package builds:

```sh
node --test scripts/bostan-private-mac-http-evidence.test.mjs scripts/bostan-private-mac-live-http.test.mjs
BOSTAN_MAC_HTTP_QA=SYNTHETIC_ONLY node scripts/bostan-private-mac-live-http.mjs --run
```

Require process exit 0, `macAuthenticatedHttpQualified:true`, `timeout:false`, `ownedFixtureCleaned:true`, and seven true stages. Verify no test-owned PostgreSQL processes remain. Inspect prior owned `/private/tmp/bostan-b093*` fixtures only if they can be distinguished from user files and verified to have no running PostgreSQL. Never clean unrelated files or system services.

Remaining Bostan gates: native Windows authenticated server and Chromium, Mac Chromium E2E, real zero-cost agent task, compiled server/build, native installers, security and licensing. **PRIVATE, Draft, NO-GO.**
