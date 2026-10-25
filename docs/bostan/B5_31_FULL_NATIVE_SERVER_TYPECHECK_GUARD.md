# B5-31 — Native TypeScript full-server diagnostic and document guard typing fix

Bostan PRIVATE source work. No merge, deployment, publication, inherited GitHub Actions, provider inference or paid resource.

## Actual full-server typecheck breakthrough on 8-GiB Mac — 2026-10-26

The normal monorepo server TypeScript checker previously exhausted the available memory and was SIGKILLed before emitting a result; that was NOT a successful source check.

For a lower-memory, no-paid diagnostic we installed @typescript/native-preview version 7.0.0-dev.20260707.2 into a fresh disposable directory outside the repository. This did NOT alter package manifests, lockfiles or tracked dependencies. Native tsgo was invoked on the REAL entire server/tsconfig.json with --noEmit and 2,747 source TypeScript files. The initial run completed (not SIGKILL) and reported exactly one TypeScript diagnostic:

- server/src/services/native-runtime/paperclip-runner-tool-authority.ts: required key missing from a dynamic Record<string, any> at the runnerTaskDocumentFormatAllowed call (TS2741).

The bridge has already parsed tool arguments against the strict write_task_document schema. The guard function intentionally takes required key plus optional format to protect the sole independent-verification JSON document key. B5-31 changes only the invocation to project these two fields explicitly from the schema-validated dynamic input object. This restores the compile-time required-key contract WITHOUT weakening the guard, modifying the schema, permitting a new JSON key, changing permissions, or bypassing REST/run authorization.

The exact same full-server native compiler was then run again with --noEmit, on the fixed branch. **Native TypeScript exit code 0, zero diagnostics.** The temporary native compiler installation was deleted after each check. No paid API or external AI was used.

Important: the project still needs a resource-qualified run of its normal TypeScript tsc command and a reproducible production build/installer before release. This successful tsgo result is explicit compiler evidence but not a substitute for every official release check, nor a promise of identical diagnostics between compiler implementations.

## Regression verification

- Focused Bostan runner bridge document schema/REST catalog tests: **3 PASS**, retaining Markdown default and the narrow JSON-key exception.
- Broad Bostan Node source suite: **147 PASS, 0 FAIL, 9 Windows-specific SKIP**.
- Attempt to execute the wider real native-runner authority PostgreSQL suite failed during embedded PostgreSQL initialization before assertions could execute (29 skipped). This is a separate test infrastructure blocker, NOT an authority integration test pass or a proven code failure. Do not hide or recast it.
- Existing B6-17 source app + PostgreSQL + Chromium E2E for static HTML privacy remained qualified on the parent branch; B5-31 only changes typed argument projection in the native-runner bridge, not SPA or app routing.

## Unqualified release gates

B5 actual free-model first-agent task Done/readback with run-owned comment, second independent source-aware reviewer and canonical Case remain OPEN (current OpenRouter free allowance exhausted). Successful full official server tsc, native installed Windows Bostan + bundled database/browser, independent comprehensive security and packaging also remain OPEN. Repository private, Actions disabled, Draft/unmerged, Release NO-GO.
