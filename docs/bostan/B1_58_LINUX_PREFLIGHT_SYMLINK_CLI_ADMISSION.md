# B1-58 — Linux preflight CLI symlink-entry fail-closed

Date: 2026-10-29. Strictly PRIVATE, ZERO-COST, NONPUBLISHING. Exact stacked parent B1-57 Draft #311 at `ba3543512f62fd11c565411665e3c6b8b91c4038`.

## Genuine source-backed defect

The B1-57 preflight used `resolve(process.argv[1]) === fileURLToPath(import.meta.url)` to decide whether to execute its CLI. Node resolves a symlinked module to its canonical import URL, while `process.argv[1]` can retain a symlinked invocation path. The two strings then differ: `--check` silently produces no report and exits **0**, allowing the calling Bash stage to print its admission marker and continue without the native Linux prerequisites being checked. macOS `/tmp` -> `/private/tmp` exposed the path-alias issue; an explicit symlinked entry reproduces it on the original B1-57 source. This is a preflight bypass, **not** evidence that the full Linux product ran.

## Repair

Prefer Node 24+ `import.meta.main` for entrypoint identification. For older test Node versions, compare `realpathSync` of both entrypoint paths; unresolvable paths refuse the fallback match. Preserve inert import behavior, read-only checks, fixed-allowlist diagnostic output and existing Linux prerequisite requirements. No package installs or host changes.

## Actual RED / GREEN on authorized Mac, isolated synthetic fixture

- Source and inherited test files were extracted by `git archive` from exact B1-57 SHA `ba3543512f62fd11c565411665e3c6b8b91c4038` into a uniquely named owned `/tmp/bostan-b158-owned.*` workspace, not the original B135 checkout.
- Added regression with an owned symlink to the exact source file, asserting `--plan` emits JSON, invalid `--publish` exits 2, and `--check` emits an actual structured admission report.
- **RED on unmodified source:** 5 PASS / 1 FAIL, `SyntaxError: Unexpected end of JSON input` because the symlinked CLI silently emitted no output.
- **GREEN after fix:** Node 26 native Mac **6/6 PASS**, 0 failed/skipped, `node --check` PASS. Direct `--plan` also emitted the expected JSON.
- Exact executed source Git blob `39acf4b3e966bf50e56cae6572e702db46fe9f07`; executed test Git blob `4aae8581293c762b9c6277d8c8396e3d37736cbb`.
- This is a focused native Mac regression, not a Linux Node24/PG/browser/installer qualification. No Windows native test or full product E2E in B1-58.

## Remaining gates

Native Linux Node24+ / pnpm / PostgreSQL and full authenticated server/browser E2E, Windows multi-suite PG orphan proof, installed Windows/Mac/Linux packages, model sandbox and consent, security/privacy/license/NOTICE/provenance and independent release gates remain unqualified. Product release **NO-GO**. No main merge, Actions, deployment, npm pack, publishing, paid model or customer data.
