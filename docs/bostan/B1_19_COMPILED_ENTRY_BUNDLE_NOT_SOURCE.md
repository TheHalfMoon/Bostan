# B1-19 — Compiled entry must execute the compiled server chunk

**Date:** 2026-10-29 UTC. **Repository:** PRIVATE `TheHalfMoon/Bostan`. **Stack:** new Draft on B1-18 PR #271 exact parent `6a9fde6d9b2df0425d122d875c19d840fb047a2e`; main read-only `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a`. GitHub Actions OFF. No merge, release, publish, deployment, npm pack, paid services or customer data.

## Actual product defect and red test

The B1-18 compiled entry `index.mjs` was generated with `await import(new URL("file:///.../dist/index.js").href)`. Although esbuild also generated `server.mjs`, the entry executed the **original, mutable source dist/index.js**, bypassing the compiled server chunk. Thus an apparently successful compiled smoke test did not prove execution of the bundle, and the entry would fail when the original source was removed or modified.

On native Windows 11 Node v24.19.0, a fresh marker-owned `D:\Bostan-B119-temp` synthetic fixture used the **exact B1-18 GitHub** helper blob `05406e3baa021a5aa1e4580b1bf990448f404d2f` and bundler blob `d6a7cd92aeb1d3fb9803fcbf0cd3edccd8063873`, with the existing free esbuild 0.28.2 dependency linked read-only from a separate clean QA checkout. The real esbuild bundle completed; after changing only the fixture's original source to throw, the new regression **failed 1/1 as expected**: the generated `index.mjs` executed the modified source rather than the compiled chunk. No Bostan server, database, network provider or user data was involved.

## Production fix

`server/scripts/compiled-runtime-entry.mjs` now validates the native source path but loads `new URL("./server.mjs", import.meta.url).href` dynamically, i.e. the **sibling compiled chunk**. The dynamic URL avoids esbuild's eager file-URL resolution; Node accepts the relative URL on Windows, Linux and macOS. The original native path is retained only as `process.argv[1]` for legacy main-module checks, not imported as code. The unchanged bundler still produces the `server.mjs` chunk and canonical file URLs for package-private external modules.

The updated tests assert that the generated entry never imports the original source URL, execute the compiled entry after replacing its original source with a throwing file, then move the compiled runtime directory, delete the original source entry, and execute the relocated compiled entry. All test fixtures are synthetic and marker-owned.

## Genuine native Windows verification

Before execution: Abdulaziz device online, Mac offline; CPU ~22%, free RAM ~2.99 GiB, C ~8.67 GiB, D ~16.09 GiB; Node v24.19.0, pnpm 9.12.0. Existing `D:\Bostan-B111-qa` was clean and not edited; no PostgreSQL process was present. Only the independently owned B119 fixture and its esbuild junction were created. No heavy PostgreSQL, HTTP or Chromium work was started.

- **RED:** old exact B1-18 helper plus a real esbuild build and source mutation: **0 pass / 1 fail**, expected.
- **GREEN:** new exact GitHub helper, two committed regression test files and one independent temporary B119 red-green test: **7/7 PASS**, 0 fail/skip/cancel, 0.61s. The committed test files alone account for **6/6 PASS**.
- `node --check` passed for the four tested source/test files. `git hash-object` on the actual Windows fixture matched the GitHub blobs:
  - `compiled-runtime-entry.mjs`: `c08e4c4a0e46503c81626af5008290741aa75ab1`
  - `compiled-runtime-entry.test.mjs`: `68a34726eced6bd75ec03db075581230d880cae4`
  - `compiled-runtime-esbuild.test.mjs`: `6cda941548ac1fc88da96f7ecf7af0e87f73705c`
  - unchanged `bundle-runtime.mjs`: `d6a7cd92aeb1d3fb9803fcbf0cd3edccd8063873`
- Native esbuild synthetic bundle, plain-Node execution of both chunks, modified source rejection, and relocated compiled entry without original source: **PASS**.

## Remaining NO-GO gates

This fixes a real compiled-runtime entry defect, **not** the separate nested Runner `check:protocol-coverage` Windows drive-letter error, the complete frozen-dependency Bostan server build, or the 180-second native source HTTP stall. External package-private modules and source-location-sensitive assets may still require their original paths; relocating only the compiled runtime directory is **not** installer qualification. No real Windows authenticated 18-stage HTTP, Chromium, zero-cost agent, full multi-suite PostgreSQL zero-orphan, Mac E2E, installer, independent security/licensing or recovery gate was qualified here. Issues #234 and #237 remain OPEN. Overall release **NO-GO**.

Keep the Bostan name, preserve legal attribution/NOTICE, and maintain PRIVATE stacked Draft only.
