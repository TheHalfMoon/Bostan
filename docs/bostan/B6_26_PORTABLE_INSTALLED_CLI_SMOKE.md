# B6-26 — Portable private CLI installation smoke / Windows read-only status

Private Bostan development, 26 October 2026; stacked on B5-39 PR #152. Never merge to main, release, publish, enable Actions, use paid models or touch unrelated HOME data.

## Observed source QA failure on actual Windows

Running cli/src/__tests__/bostan-local-install.test.mjs natively on Windows Abdulaziz failed its only Windows-applicable test, read-only status, before it could assert no directories were created. The test used URL.pathname for absolute filesystem paths. In native Windows Node, a file URL pathname is not necessarily a valid C: path. The test also constructed a POSIX-only PATH separator.

Fix the QA fixture only:
- Convert file URLs to absolute filesystem paths using standard Node fileURLToPath.
- Construct PATH with Node path.delimiter and the host's existing PATH (not a hardcoded POSIX-only path).
- Preserve the same exact isolated temporary HOME, source CLI commands, failure codes and refusal assertions.
- On Windows, all actual POSIX-only installs stay SKIPPED by the platform gate; do not enable Windows installation without independent installer qualification or change production CLI permissions.

## Actual installed Mac evidence

A built Bostan preview CLI (version 0.3.1) was installed and invoked in a disposable private HOME, not the user's real HOME. The 13 actual Node installation tests include version/status through the installed shim, installed payload integrity checks, source checkout removal tolerance, safe local export ZIP inspection, source identity, the absence of writes into inherited original product storage, quote-safe paths, and refusal of update/upgrade/service and unsafe symlinks. **13 PASS, 0 FAIL, 0 SKIP**. It is only the local CLI PREVIEW, not an installed server, native agent runner, or Windows installer.

## Qualification boundary

The Windows source read-only status can be verified on native Windows after this branch is fetched. It must not be advertised as an installed Windows application. Official server compiler/build, real free-model signed governed Case, installed Windows source+browser/package, and independent comprehensive security remain open. Release NO-GO.
