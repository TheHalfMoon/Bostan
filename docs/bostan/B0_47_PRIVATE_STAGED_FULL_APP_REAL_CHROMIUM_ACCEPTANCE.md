# B0-47 — Self-contained staged Bostan server and real production UI acceptance

**2026-10-27**. Private stacked Draft above B0-46 (#195, `8a2f5984276722941c797df11cc1d77cdfadfe1e`). Keep TheHalfMoon/Bostan **PRIVATE**, inherited Actions **DISABLED** and `main` unchanged. No deploy, publish, paid AI/model providers or customer-data mutation.

## Actual limitation addressed

B0-46 built Bostan server JavaScript and proved HTTP 200 from the **source workspace**. This did not prove a deployment folder independent of the checkout or guarantee a bundled UI. Using the private production pnpm deployment flow without network calls:

```bash
pnpm --filter @bostan/server deploy --prod --offline --ignore-scripts /private/tmp/bostan-staged-server-<temporary>
```

The actual `pnpm deploy` created a roughly **1.6–1.7 GiB** isolated folder and populated production `node_modules`, real `dist/index.js`, the 375 SQL migrations, package-owned adapter scripts and vendor assets. On this pnpm version, **one generated pnpm self-reference** (`node_modules/.pnpm/node_modules/@bostan/server`) still pointed to the source checkout's `server/` directory. This is an independence/security problem even if the application otherwise starts.

## Source-controlled implementation

1. `scripts/bostan-private-staged-server-check.mjs` provides read-only `--verify <absolute-stage>` and explicit, tightly scoped `--repair-owned-self-link <absolute-stage> --source-checkout <absolute-checkout>`. The repair only modifies the *one known generated pnpm self-link* when it points to the exact authorized checkout's `server` folder, and only inside a personally owned disposable `bostan-staged-server-*` temp directory. Any other foreign or broken link is rejected. Read-only verification checks Bostan private identity, compiled server/DB/shared/adapter/SDK/vendor files, at least 375 migration SQL files and **all symlinks**, following zero outside the stage. It never publishes or scans private user directories.
2. Added the strictly explicit `--run-deployed <absolute-stage>` mode to the existing isolated Postgres+HTTP script. It runs **compiled migration JS and compiled server JS from the stage**, and not TypeScript/TSX from the source. The prior `--run` and `--run-dist` modes remain intact. When `ui-dist/index.html` exists, checks real rendered HTML contains the `Bostan` title, `Referrer-Policy: no-referrer`, production hashed JavaScript asset HTTP delivery with a JavaScript MIME type, and unknown assets returning 404 rather than HTML.
3. `ui/scripts/bostan-private-staged-browser.mjs` is a real Playwright Chromium first-paint acceptance: **only** explicit `http://127.0.0.1:<private-port>/` URLs are valid; all attempted browser requests outside that origin are blocked. Checks HTTP 200, Bostan title, meaningful body content, compiled-module presence, **zero JavaScript exceptions and zero outbound requests**. Service workers are blocked. Opt-in only, safe read-only default.
4. `scripts/bostan-private-staged-full-app-acceptance.sh` orchestrates everything with one `--run`: frozen **offline** pnpm install with lifecycle scripts disabled, B0-46 private JS/server/DB smoke, real Vite UI build and copy, **offline** production pnpm deploy, one-link repair, whole-stage verification, isolated PostgreSQL / deployed compiled migration / deployed HTTP, and actual Chromium production UI. No Rust release compilation or external inference. It requires local tools and at least **4 GiB** scratch free, uses a fresh invocation-owned temp stage, and deletes **only that** stage on completion/failure. No user HOME installation or publication.

## Evidence from authorized macOS arm64

Executed a real `pnpm deploy` from the current private checkout with zero downloads and scripts disabled. The stage started successfully on an ephemeral local PostgreSQL installation using its **own compiled migration executable** and `node --conditions=bostan-compiled dist/index.js`. After the exact pnpm-generated link repair, the **complete scan recorded 1,894 internal symlinks and 0 external links**, **375 SQL migrations**, and the Bostan private package manifest. HTTP `/api/health` returned **200** with `status=ok`, `authReady=true`, `bootstrapStatus=ready`, `deploymentMode=local_trusted`, `deploymentExposure=private`; the production UI root, JS module and missing-asset 404 all passed.

The built Bostan Vite UI was copied into the deployment's `ui-dist` (about 22 MiB). **Real headless Chromium** against that separate deployment passed: title `Bostan`, meaningful body, production modules present, **0 browser JS exceptions, 0 attempted remote requests**. No model credentials/services were used, and the ephemeral Postgres cluster was stopped and deleted.

Then ran the entirely reproducible command, from prepared offline dependencies, **not a series of manual fixes**:

```bash
bash scripts/bostan-private-staged-full-app-acceptance.sh --run
```

**Exited 0** in about 89 seconds. Observed `BOSTAN_PRIVATE_COMPILED_SERVER_HTTP_ACCEPTANCE_PASS`, `BOSTAN_PORTABLE_STAGED_UI_HTTP_QUALIFIED`, `BOSTAN_PORTABLE_STAGED_BROWSER_FIRST_PAINT_PASS`, `BOSTAN_PORTABLE_STAGED_SERVER_HTTP_QUALIFIED` and `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`. Its own random temp stage was confirmed **deleted after completion**. The first attempts exposed (and the final script resolved) a missing workspace TypeScript binary caused by an overbroad `npm_config_ignore_scripts` environment setting. The final process uses explicit `--ignore-scripts` flags on **install and deploy only**, preserving normal local workspace compiler discovery.

**16/16 source contract/guard/negative tests passed**, including broken/foreign link refusal, permission to repair only the expected owned self-link, disabled implicit CLI actions, mandatory local-only URL, outbound-request and browser JS-error rejection, source-export preservation, and the one-command private, offline, scratch-cleanup contract. Neither the raw host logs nor the large staged package are committed.

## Remaining release gates / limitations

- This is a **source-built standalone server+UI production *staging* acceptance on macOS**, not a signed native GUI installer, notarized `.pkg`/`.dmg`, full release build or a public/private customer installation.
- The `pnpm deploy` command reported some missing/unmet optional/peer dependencies (React, types, Vite and Anthropic SDK). The real UI test passed, but the dependency closure needs a separate release-quality audit.
- Real agent inference and governed Case scoring, Windows installer and browser/desktop lifecycle, Linux installed runtime, complete source compiler/typecheck on low-RAM devices, and independent security/legal audits are not qualified.
- The historical versioned protocol and license/provenance records are intentionally preserved. Bostan remains in **Release NO-GO**; do not merge `main`, enable inherited Actions or publish.
