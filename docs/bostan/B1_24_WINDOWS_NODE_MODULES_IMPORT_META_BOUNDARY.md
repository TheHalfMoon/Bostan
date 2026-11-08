# B1-24 — Keep private node_modules locations out of compiled Windows bundles

Date: 2026-10-29. Repository: TheHalfMoon/Bostan (PRIVATE). Exact parent: B1-23 Draft PR #276 at `c1a89abab327a38863f1947a9332fce3b5d0b979`. Stacked Draft only; no main merge, publication, deployment, packaging, paid inference or customer data.

## Reproduced production defect

`server/scripts/bundle-runtime.mjs` intentionally excludes third-party `node_modules` source from the `keep-module-locations` import.meta URL rewriting plugin. The exclusion used `args.path.includes("/node_modules/")`, which misses native Windows esbuild paths containing backslashes. In a real Windows 11 Node 24.19.0 / pinned esbuild 0.28.2 synthetic bundle, a package at `server\\node_modules\\bostan-fixture-location\\index.mjs` containing `import.meta.url` was rewritten into a literal absolute private file URL in `server.mjs`.

An independent real esbuild regression on the unmodified B1-23 source failed **RED 0/1**: `compiled bundle must not embed the private node_modules source URL`. The synthetic fixture was created under the marker-owned B124 TEMP only; no operator data was read.

## Narrow production fix

Normalize the esbuild onLoad path separators before checking for the `/node_modules/` segment. Keep the original first-party source-module `import.meta.url` rewrite behavior unchanged for source-relative asset compatibility. The test verifies the bundled third-party dependency does not embed or print its private original source URL and that a first-party module still prints its expected source URL.

## Actually executed evidence

- Authorized Windows 11 device Abdulaziz, Node 24.19.0, pinned offline esbuild 0.28.2, isolated fresh `D:\\Bostan-B124-qa` cloned from exact B1-23 head and marker-owned `D:\\Bostan-B124-temp`.
- Frozen offline pnpm `--filter '@bostan/server...' --ignore-scripts` install completed, 803 packages in scope; zero downloads. A first attempt with an unsupported pnpm install flag failed before installing; the corrected command succeeded.
- Exact parent source + new regression **RED 0/1** as expected, with a real compiled `server.mjs` containing the private synthetic node_modules file URL.
- After fix, native Windows `node --check` both modified JS files PASS, and three relevant test files **10/10 PASS, 0 FAIL, 0 SKIP**: actual esbuild bundles, plain Node execution, first-party source-location compatibility, compiled workspace, external third-party behavior, and owned-output deletion admission.
- `git diff --check` PASS. No PostgreSQL, server, browser, agent or installer process was launched.
- RAM fell from 3.64 GiB free before checkout to 2.37 GiB after dependency installation; full server build and real PG/HTTP were deliberately not started below preferred >=2.8 GiB free admission. C free ~8.62 GiB, D free ~14.33 GiB at that checkpoint; PostgreSQL process count zero.

## Limits / release

This qualifies one real Windows compiled bundle boundary, not a complete Bostan server build. The separate nested Runner `ERR_UNSUPPORTED_ESM_URL_SCHEME` during full recursive build is still unproven, and the 18-stage authenticated native HTTP, Chromium, multi-suite PostgreSQL zero-orphan (#234), source startup (#237), actual zero-cost agent, Mac, installer, privacy/licensing and backup/recovery remain unqualified. Do not treat an isolated synthetic bundle as a complete product gate. Release **NO-GO**; repo PRIVATE, Actions OFF, stacked Draft only.
