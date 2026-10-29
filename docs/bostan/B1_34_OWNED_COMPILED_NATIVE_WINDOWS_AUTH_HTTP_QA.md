# B1-34 — Native Windows authenticated HTTP QA can use the SHA-256-owned compiled server

Date: 2026-10-29. PRIVATE, nonpublishing `TheHalfMoon/Bostan`. Exact parent B1-33 Draft PR #286 at `0c634e6acd137ea81016f8e5709363b9d078da09`.

## Actual product qualification blocker

The still-open [Windows live HTTP issue #237](https://github.com/TheHalfMoon/Bostan/issues/237) records two actual native-Windows TypeScript source-server attempts that started/migrated PostgreSQL but did not reach the authenticated/private/bootstrap-pending HTTP health endpoint. The first source startup imported over 5,000 modules and the bounded 180-second startup health check never passed. B1-21 through B1-33 established a compiled-runtime builder and owner manifest, but the **existing native authenticated HTTP harness** still unconditionally spawned `tsx` with `bostan-private-windows-server-entry.mjs`. Consequently it could not qualify the new plain-Node runtime through the same real synthetic user/session/admin/origin flow.

## Narrow production-test harness change

- Add `scripts/bostan-private-windows-server-command.mjs` to resolve an explicit `source` or `compiled` mode. **Default `--run` source mode is unchanged**, retaining the existing `--import tsx`, source import profiler and bounded startup diagnostics.
- Opt-in `--run-compiled` selects the exact **`server/dist-runtime/index.mjs`** with plain Node and the existing synthetic isolated HTTP/PG QA environment. Before creating temporary application state or starting PostgreSQL it calls the **existing production `assertSafeRuntimeOutdir(server/dist/index.js, server/dist-runtime)`** from B1-23/B1-26. That checks the local built source, source ancestor and output path for links/junctions, exact manifest schema/source/output binding, complete flat inventory and SHA-256 hashes of all generated files. Missing, unowned, modified or foreign output fails closed: **no unverified runtime execution and no silent TypeScript fallback**.
- The actual HTTP runner's `spawn(process.execPath, nodeArgs)` uses the selected mode but preserves its existing native-Windows-only, isolated named checkout/TEMP, free RAM/disk, localhost, embedded PostgreSQL, auth cookie, first-admin and tenant isolation, bounded health check, evidence and owned teardown restrictions.
- Emit safe `BOSTAN_WINDOWS_LIVE_SERVER_MODE=source|compiled` for provenance. No full app deployment and no credential copying to the host.

A qualifying Windows run, from an authorized Bostan three-digit QA checkout that already passed memory/disk admission, must first produce a complete built `server/dist/index.js` and SHA-256-owned `server/dist-runtime/index.mjs` using the already pinned package commands. The two **different** explicit QA invocations are:

```sh
# Existing source-server comparison (unchanged)
node --import tsx scripts/bostan-private-windows-live-http.mjs --run

# New, explicit compiled-server authenticated HTTP gate
node --import tsx scripts/bostan-private-windows-live-http.mjs --run-compiled
```

Do not run this from arbitrary user workspaces or with production PostgreSQL, managed Cloud keys or customer data. Neither command bypasses the native Windows QA admission policy.

## Executed evidence — NOT a native-Windows qualification

Local isolated Linux Node.js **22.16.0**, owned synthetic temporary files. Imported the exact original GitHub production owner validator with verified Git blob `54186304422c085b445a9dad0c7160f4ddac74a1`.

- New helper unit and executable plain-Node synthetic compiled-entry tests: **9/9 PASS**. They include original source-mode args unchanged, unmarked bundle rejection, SHA-owned acceptance, modified file and foreign file refusal with foreign sentinel unchanged, missing source, linked output, unsupported mode/uncanonical root, validator admission mismatch and actual child process `node index.mjs` run without `tsx`.
- Combined with local inherited B1-27/B1-28/B1-30/B1-31/B1-32 and B1-33 suites: **48/48 PASS**, 0 failed/skipped, total 13.5 seconds; `node --check` for the new helper and regression test passed.
- GitHub and locally executed SHA identities:
  - helper `83889bb65f5b49d3fd6a49c361bd2b4f93d4c5f7`
  - helper test `9e65b31500686159e0706aaab56737a5d3a2b12b`
  - integration change in existing private Windows harness `8e3a018005bd642845bee9f0d7fd1629f06f50c1`, reviewed for argument/operation ordering.
- Both Remote Desktop Commander devices (authorized Windows Abdulaziz and Mac) OFFLINE during this wave. No actual Windows compiled-server process, native PostgreSQL, authenticated 18-stage HTTP, Chromium, first real local agent or Windows installer was run here.

## Remaining NO-GO gates

The new mode makes the **real product** authentication/HTTP test possible using the compiled runtime. It does **not** prove full esbuild 0.28.2 succeeds on Windows, that the compiled server ever reaches health 200, that Better Auth signup and claim work, that embedded PostgreSQL multi-suite orphan workers are gone (#234), or that Chromium/Mac/installer/privacy/license gates pass. A build success without real HTTP evidence cannot close #237.

Repo strictly PRIVATE; no GitHub Actions enable, protected-main merge, publish/deploy/release, npm pack, paid models/cloud or real customer records. Stacked Draft only; release **NO-GO**.
