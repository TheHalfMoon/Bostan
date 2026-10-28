# B1-16 — Windows native source startup diagnosis and actual PostgreSQL qualification

Date: 2026-10-29. Bostan PRIVATE, Draft only, no publish. Stacked parent: concurrent B1-16 managed-child stop-deadline Draft PR #268 at `83042a0546d47249f249edba3f8acc97c3002289`, itself based on B1-15 Draft PR #267 at `fccfc7dcf615e45bbae1c3b80ec04f9538409d01`. Distinct files, no dropped changes.

## Goal and boundaries

Reproduce the real Windows localhost startup blockage #237 rather than mark static tests or a healthy PostgreSQL cluster as a working authenticated Bostan server. Do not print exception messages, credentials, private absolute paths, HTTP response bodies, or full stack traces. The synthetic QA fixture and process owner must be proven before starting the test. Do not weaken any memory/disk/source-path/identity or teardown gate.

## New failure-safe diagnostics

- `scripts/bostan-private-windows-failure-site.mjs` extracts only a whitelisted repo-relative source frame from a Node stack (or `unknown`), allows an explicit finite set of OS/Node/PostgreSQL error codes (or `unknown`), and independently distinguishes a validated npm package name or repo-local missing module path. All inputs are untrusted; no raw error or stack is logged.
- `scripts/bostan-private-windows-server-entry.mjs` emits those restricted diagnostics only if the existing authenticated/private synthetic Windows entrypoint's `startServer()` fails.
- `scripts/bostan-private-windows-live-http.mjs` parses only fixed marker prefixes with a restrictive whitelist before writing its own evidence. Existing strict HTTP stages, PowerShell orphan proof, child close, DB cleanup, and owned-fixture removal remain intact.
- Independent dependency-free native Windows test suite checks external and sibling path rejection, malicious error text, local and npm package naming, unsafe arbitrary codes, and source-path whitelisting.

## What actually ran

Native Windows 11, Node 24.19.0, pnpm 9.12.0. Checkout `D:\Bostan-B111-qa`, matching agent-created `D:\Bostan-B111-temp`. All real database files were in disposable synthetic TEMP fixtures; no paid model, real user DB, or hosted service was used.

1. Installed 137 pinned `@bostan/db...` dependencies and later 666 pinned `@bostan/server...` dependencies from public npm, `pnpm --frozen-lockfile --ignore-scripts`. Initially offline-only install correctly refused missing tarballs. Installed the CLI workspace dependencies separately, then `pnpm run preflight:workspace-links` **PASS**. npm and local pnpm lockfile are public package sources; nothing was deployed/published.
2. Real native database fresh-initdb and migration selected Vitest test: **1 PASS, 14 not selected**. A subsequent two-file serial/fork-worker test ran actual migrations and a database transaction/savepoint work-signal test: **2 PASS, 25 not selected**. Confirmed Windows `postgres.exe` process count **ZERO** immediately after completion (up to 10 owned PostgreSQL workers existed during the run).
3. Initial native live Windows synthetic HTTP runner failed before health with `runtime_failed`, loaded ~836 modules, and later safe error code `ERR_MODULE_NOT_FOUND`. Every run exited 1 and separately proved child CLOSED, PostgreSQL CLEANED, zero orphan PostgreSQL, and fixture CLEANED. No authenticated HTTP status or signup claim succeeded.
4. Additional static diagnostics were exercised in full `scripts/bostan-private-windows-*.test.mjs` suites (14 files): **109 total, 108 PASS, 0 FAIL, 1 SKIP**; all modified JS files `node --check` passed. After rebasing this change onto concurrent Draft #268, a fresh 16-file dependency-free native Windows replay (all 14 private Windows suites plus both managed-child shutdown test files) verified **123 total, 122 PASS, 0 FAIL, 1 SKIP** (7.04 seconds).
5. Native `pnpm --filter '@bostan/server...' -r --workspace-concurrency=1 build` failed **twice** at nested `@bostan/runner check:protocol-coverage` with `ERR_UNSUPPORTED_ESM_URL_SCHEME` for Windows drive specifier `d:`. However the **same check passed** when invoked independently after failures, including a separate temporary read-only hook probe. This is unresolved build-sequence behavior; do not assert a proven static-file defect or a green complete build.
6. Built `@bostan/db` separately **PASS** with 375 byte-preserved portable migration files and migration safety receipt; built `@bostan/plugin-sdk` separately **PASS** and `@bostan/shared` license notice byte-preservation PASS.
7. Re-ran actual Windows synthetic HTTP after these individual builds. PostgreSQL **MIGRATED**, then 180-second strictly bounded /api/health wait **FAIL** with `static_import_start` (no subsequent `static_import_complete`), **5,248** module loads, approx **93,017ms** of reported import hook load time and 4 module errors. There was no HTTP response or authenticated signup/claim. This shows the source server's deep cold import and/or runtime evaluation blocked readiness; NOT qualified. The child CLOSED, DB CLEANED, no PostgreSQL orphan **PASS**, owned TEMP fixture CLEANED; final runner exit **1**. Independent Windows process inventory after run confirmed **0 postgres.exe**.
8. The diagnostic helper reveals only whitelisted repo-relative source names or `unknown`; no raw string leaks. No claim that previously failing issue #237 is fixed. Mac offline and cross-platform E2E not run.

## Next substantive engineering

Determine which source imports or Node native loader path account for 5,248-module cold-import stall, with a self-contained reproducible profile. Compare diagnostic hook impact against an otherwise identical no-profiler **synthetic local** run while retaining all database, auth, memory, disk, origin, lifecycle and orphan gates. Consider shipping a compiled/source bundle instead of importing 5,000+ modules individually only if it preserves licenses and security behavior. Fix the actual Windows runner build-sequence drive-URL error with exact reproducer before claiming full source build. Then pass all authenticated synthetic HTTP checks, Chromium and actual free local agent task.

## No-go status

Issue #234 **not fully closed** solely because two selective DB suites and the HTTP runner's zero-orphan proof passed. Issue #237 **OPEN**: full source server health/auth/browser still failed. Product release **NO-GO**, GitHub Actions OFF, repo PRIVATE; no main merge, deployment, package publication, paid model or real user data. Manual review is not required for this engineering wave.
