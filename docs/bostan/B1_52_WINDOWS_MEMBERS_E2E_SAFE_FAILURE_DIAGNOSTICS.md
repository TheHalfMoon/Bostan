# B1-52 — Native Windows Members Chromium real E2E diagnosis: RED at a browser JavaScript error

Date: 2026-10-29. Strictly PRIVATE, ZERO-COST, NONPUBLISHING. Exact parent private Draft B1-51 #305 at d0495fb07295cd6244faf814d43dae49435cef34.

## What B1-52 changed

The opt-in `--run-compiled-browser-members` test already uses the real disposable Windows PostgreSQL, packed server, Better Auth, built production UI, and pinned Chromium. B1-52 adds **fixed-vocabulary, privacy-preserving, test-only** diagnostic checkpoints, tracking only milestone names and bounded HTTP status codes, not cookies, emails, passwords, invite URLs, raw browser exceptions or user data.

The test now distinguishes blocked external HTTP, blocked external WebSockets, and Chromium page JavaScript errors. It classifies a limited list of known JavaScript exception families (e.g. null/undefined property, module-loading issue) by fixed tokens only. The existing reusable Chromium context-wide firewall now accepts an optional *in-process* error observer for **all** pages/popups, without changing network admission or logging raw messages. A malformed observer fails closed. The helper's existing owner-only browser close remains.

Test and security checks run on both Mac and native Windows. Real Mac pinned Chromium external network negative test: **16/16 PASS**, no skipped tests, HTTP+popup+WebSocket blocked. Native Windows unit regressions at diagnostic head: **20 passed, 1 opt-in real Chromium negative probe skipped** under default settings; prior separate native Windows real Chromium negative run passed 11/11 with opt-in. All source changes remain test-only; not production app behavior.

## Actual native Windows real PostgreSQL/Chromium attempts (RED)

Authorized Windows 11 `Abdulaziz`, isolated B144 checkout, pinned free Chromium, synthetic-only test accounts, full SHA256-owned packed Bostan server and fresh real PostgreSQL. All runs strictly required at least 4 GiB RAM before starting PostgreSQL, checked zero preexisting PostgreSQL and used owned TEMP directory.

1. At B1-51 source d0495fb: real Chromium signup, first-admin claim, 18 original backend HTTP/security stages up to post-claim health all PASS. B1-50 Members phase then failed before invite creation, cleanup **PASS**. No raw browser error was emitted.
2. At B1-52 source 862da11: safe milestones reached `scenario_started`, `company_created`, `third_user_signed_up`, `third_session_signed_in`; last HTTP status 200. **Failed before `chromium_invite_created`**. Owned server/PG/fixture cleanup PASS. Subsequent first-level classifier identified browser egress or JavaScript error.
3. At B1-52 source f9b5f27: classified failure more precisely as **`members_browser_js_exception`**, not blocked external HTTP/WebSocket; actual server and PG cleanup PASS.
4. At B1-52 source 573c90a: main-page-only JS classifier saw `members_browser_js_none` while context-wide monitor had seen a page exception, implying the exception was outside its individual page listener or before it observed it; do not infer a specific cause.
5. At current tested source `30b4030ebef9837fda7331da59ba97850fac9aed`, which observes **all Chromium context pages**, real native Windows run ended **exit 1 in 38.92 seconds**. All original authentication and denial stages plus synthetic company creation, third signup and third session login PASS. The exact test-only safe failure class is **`members_browser_js_unclassified`** at `third_session_signed_in`, with last HTTP status 200. No invite was generated. Shutdown/teardown passes: `BOSTAN_WINDOWS_LIVE_SERVER_CLOSED`, `BOSTAN_WINDOWS_LIVE_POSTGRES_CLEANED`, `BOSTAN_WINDOWS_LIVE_NO_POSTGRES_ORPHANS_PASS`, `BOSTAN_WINDOWS_LIVE_OWNED_FIXTURE_CLEANED`, `manualOwnedFixtureInspectionRequired:false`. `authenticatedBrowserQualified:false`, `windowsAuthenticatedHttpQualified:false` for this combined Members path (because priorFailure true), `releaseQualified:false`.

**No confirmed root cause for the context-wide page JavaScript exception.** Do not relax the zero-browser-errors requirement or falsely claim Members/Invites E2E is GREEN. Prior B1-49 native Windows Chromium signup + first-admin E2E remains separately GREEN and is not invalidated by the stronger Members path failing.

## Next engineering gate

Inspect the real Members page's JavaScript failure using strict privacy controls and a bounded allowlisted source-error category/site, or reproduce in the existing disposable Mac fixture. Only then fix the actual product defect (if confirmed), rerun at exact current source SHA and require real invite creation, acceptance by the third session, viewer write denial, operator promotion enabling write, suspension revoking write and exact no-orphan teardown.

Bostan release NO-GO. Other unresolved gates: actual zero-cost offline agent execution, native installers/Linux, multi-suite PostgreSQL concurrency/stress and independent security/privacy/license/provenance. Do not merge protected main, enable Actions, publish, deploy, npm pack, use paid models/customer data or touch unrelated files/processes.
