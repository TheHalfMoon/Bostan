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

The pre-change baseline is main `c838939bb5f3d6cf38bd79b264809025b6402a4a`:
all 15 CI jobs passed, but none compiled and booted the server. Native local
focused command-selection, health and workflow-guard tests passed (19 tests).
The complete local build was not attempted with about 1 GiB available RAM;
hosted native Windows CI supplies build/startup evidence. A passing helper
test alone does not qualify the compiled application.

Still separate: compiled browser onboarding, persistence/recovery, packaged
installation, independent orphan-process verification, and macOS/Linux runtime
qualification. Issue #237 remains open until its acceptance evidence is complete.
Publication remains disabled; this lane neither publishes nor creates a release.
