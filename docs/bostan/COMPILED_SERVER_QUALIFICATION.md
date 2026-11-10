# Compiled server qualification

The Windows CI lane builds `@bostan/server` and its workspace dependencies
serially, then runs the synthetic authenticated/private journey with:

```sh
pnpm --filter @bostan/server... --workspace-concurrency=1 build
node scripts/bostan-windows-server-journey.mjs --compiled
```

This starts `server/dist/index.js` using plain Node with the
`bostan-compiled` export condition and `NODE_ENV=production`. It never falls
back to the source loader. The existing source-mode command is unchanged.
The journey creates a disposable home and embedded PostgreSQL cluster, checks
health, synthetic signup/session cookies, first-admin claim and conflict, and
tenant isolation, then stops PostgreSQL and removes its disposable state.
Do not run against an existing user database.

The child receives an allowlisted OS environment and explicit disposable
configuration, without operator database URLs, provider keys or Node preloads.
Compiled mode verifies the HTTP listener's PID before signup. Cleanup requires
the server PID to be gone and the existing independent PostgreSQL scanner to
report three clean process snapshots before the disposable home is removed.
Only bounded error codes (not raw logs, paths or secrets) survive startup errors.
Windows checkout disables CRLF conversion before fetching hashed Runner inputs.

The pre-change baseline is main `c838939bb5f3d6cf38bd79b264809025b6402a4a`:
all 15 CI jobs passed, but none compiled and booted the server. Native local
focused command-selection, health and workflow-guard tests passed (19 tests).
The complete local build was not attempted with about 1 GiB available RAM;
hosted native Windows CI supplies build/startup evidence. A passing helper
test alone does not qualify the compiled application.

The first hosted Windows build at PR head `173495a1` failed before server
compilation: `The generated PRP contract manifest is stale`. Independent
read-only reproduction found that CRLF conversion changed all 54 protocol
fixture hashes. This is a failed qualification attempt; disabling conversion
before checkout fixes its cause, and the subsequent full build must pass
separately. After isolation/ownership additions, 36 focused checks passed locally.

At head `4667a5e3`, the complete Windows build passed, including the Rust Runner,
but the compiled server exited with `ERR_MODULE_NOT_FOUND` before PostgreSQL
startup. A local diagnostic-only transpilation (not a qualified build) identified
missing `.mjs` helpers in `@bostan/db/dist`: the database build copied migrations
but not the three JavaScript helpers imported by its public entrypoint. The
build now copies those original bytes. The regression first reproduces missing
imports, then imports all shipped helpers under plain Node after removing the
source tree. Unsafe linked directories and hard-linked outputs are refused.
The diagnostic TypeScript no-check emit was stopped after excessive memory use;
esbuild emission was used only to locate the missing import. Full tsc and native
runtime evidence still come from CI.

Still separate: compiled browser onboarding, persistence/recovery, packaged
installation, and macOS/Linux runtime
qualification. Issue #237 remains open until its acceptance evidence is complete.
Publication remains disabled; this lane neither publishes nor creates a release.
