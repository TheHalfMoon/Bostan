# B1-18 — Native Windows compiled runtime file-URL imports

**Date:** 2026-10-29 UTC. **Repository:** PRIVATE `TheHalfMoon/Bostan`. **Stack:** Draft #270 exact parent `82af9421e5e7dfaf733929a8d8102d75b9a5c69a` (itself based on Draft #269); protected main read-only at `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a`. GitHub Actions remain OFF; no merge, publication, deployment, npm pack, paid model, customer data or human review request.

## Actual compiled-runtime blocker

The existing `server/scripts/bundle-runtime.mjs` generated `await import("D:\\...\\index.js")` for a Windows absolute entrypoint and emitted native absolute `D:\\...` imports for package-private external dependencies. Node's Windows ESM loader treats the drive letter as a URL protocol `d:` and refuses it.

**Reproduced on native Windows 11, Node 24.19.0:** The exact B1-17 parent `bundle-runtime.mjs` blob `acca0d4861f5650b2044a85d1c9e36678c323fde` built a disposable synthetic runtime using esbuild 0.28.2, but executing the generated entry failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME`, received protocol `d:`. A direct `import("D:/...")` control reproduced the same error. No real Bostan backend, database or user data was involved.

## Production fix and red-green refinement

- New `server/scripts/compiled-runtime-entry.mjs` converts only native absolute local filesystem paths to `file:` URLs; rejects relative, drive-relative, URL-like and null-containing input, and UNC on Windows. It keeps `process.argv[1]` as the original native path for legacy main-module detection.
- The first fix generated a literal `await import("file:///D:/...")`. **Real esbuild compilation failed**, because esbuild tried to resolve the file URL as a bundle input. This failure was not hidden.
- Final compiled entry emits `await import(new URL("file:///D:/...").href)`, leaving the import dynamic for esbuild while giving Node a valid URL. The third-party externalizer now emits `file:` URLs instead of native absolute paths when a package-private module differs from the server's own resolution.
- Existing `server/scripts/bundle-runtime.test.mjs` tests remain unchanged. Added dependency-free Node tests plus a real esbuild integration test in `server/scripts/compiled-runtime-esbuild.test.mjs`.

## Genuine executed qualification

**Windows device:** Abdulaziz online; macbook offline. Before testing: Node v24.19.0, free RAM ~3.01 GiB, C ~8.69 GiB, D ~16.11 GiB. The existing `D:\\Bostan-B111-qa` checkout was read-only, clean on #269; no branch change or operator file modifications. An independently owned `D:\\Bostan-B118-temp` fixture with `BOSTAN_QA_OWNED` marker was used. Its only dependency was a temporary symlink to the already-installed free esbuild 0.28.2 package, which was removed without altering its target.

- Original parent native esbuild **build succeeded but runtime failed** with `ERR_UNSUPPORTED_ESM_URL_SCHEME` for `d:`.
- First literal-file-URL revision **build failed** (`Could not resolve "file:///D:/.../index.js"`).
- Final native esbuild smoke: **PASS**, 3 input modules, 2 output chunks. Both generated `index.mjs` and `server.mjs` executed with plain Node and returned `B118_RUNTIME=42`. The server chunk contained a canonical `file:///D:/...` import of a synthetic package-private module.
- Native Windows `node --test` over two committed test files: **5 PASS, 0 FAIL, 0 SKIP**, approximately 0.46 seconds. `node --check` of `bundle-runtime.mjs` PASS. Exact Windows fixture `git hash-object` matches GitHub blobs:
  - `compiled-runtime-entry.mjs` — `05406e3baa021a5aa1e4580b1bf990448f404d2f`
  - `compiled-runtime-entry.test.mjs` — `bf9a03a6f14ff9df2ef58683cd0f15736aa2a9cc`
  - `bundle-runtime.mjs` — `d6a7cd92aeb1d3fb9803fcbf0cd3edccd8063873`
  - `compiled-runtime-esbuild.test.mjs` — `35b0ba04375156976a82709dca594fafed9451f3`
- Isolated Linux Node 22.16.0 dependency-free test subset: **4/4 PASS**; this Node version is below the full app's >=24.11 requirement, so this is not a full product build.
- Post-test read-only Windows process scan: **zero Node processes with B118 owned fixture path**. The esbuild junction was unlinked after ownership verification; the exact marker-owned B118 directory was removed and verified absent. No PostgreSQL or Chromium processes were launched.

## Remaining independent NO-GO gates

This qualifies only **synthetic compiled-runtime ESM entry and package-private dependency imports**, not the full Bostan compiled server build or real HTTP readiness. The nested Runner `check:protocol-coverage` sequence-specific Windows `ERR_UNSUPPORTED_ESM_URL_SCHEME` failure was **not reproduced or fixed here**; it runs a different build path and must be independently diagnosed. Real native Windows source startup previously stalled for 180 seconds at `static_import_start`, so #237 remains OPEN. #234 full multi-suite PostgreSQL orphan cleanup remains OPEN. Still required: full frozen-dependency compiled build, 18-stage authenticated HTTP and tenant isolation, real Chromium Playwright, zero-cost first agent task, Mac retake, installers, independent security/licensing and backup/recovery qualification.

Bostan remains **PRIVATE, stacked Draft only, release NO-GO**. Preserve license/NOTICE and do not rebrand to Firmx.
