# B1-48 — Native Windows production Vite UI and real offline Chromium first paint

Date: 2026-10-29. PRIVATE, ZERO-COST, NONPUBLISHING; exact parent stacked Draft #301 HEAD `ad89cbfca286f8423c99347e52c42c3e4fa82b86`.

## Native Windows environment

Authorized Windows 11 device `Abdulaziz`; existing owner-scoped `D:\Bostan-B144-qa` worktree and locally owned `.qa-playwright-browsers`. Bostan repo remains private; no protected-main merge or publish.

Pinned Playwright `1.62.1` previously had an **incompatible** older Windows Chromium cache. Installed its correct free **Chrome Headless Shell 151.0.7922.34 (Playwright v1234)** only inside the B144-owned test directory; native `chromium.launch({headless:true})` **PASS**, `browser.close()` **PASS**. No user-owned browser installation or paid model accessed.

The current pinned workspace lockfile required extra UI/runner dependencies. One initial offline install failed on missing local tarball, and pnpm tried to recreate the shared B135 dependency root that B144 junctioned to. Before further build, restored **B135** shared dependency links from the existing frozen lock via free public npm registry, with install scripts disabled. Restoration finished **exit 0 in 39.1s**, no tracked source changes. Attached the existing exact B135 `ui`, plugin SDK and 14 other installed adapter workspace dependency locations as **junctions inside only B144**, without rerunning pnpm install against a junction. Independent read-only post-run checks found both B135/B144 tracked checkouts clean; no B144-owned Node or postgres process.

## Actually executed Windows tests

At tested branch commit `e0f780f83fcfba19bd0baa35339fe6d693fc276d`:

- **Real native Vite production UI build exit 0**, `vite v8.2.2`, **8,017 transformed modules**, built in **1m 17s**. Emitted `ui/dist/index.html` and JS/CSS assets, D free ~7.59 GiB. Existing CSS `::highlight`, Vite native config and large-chunk warnings remain informational, not a zero-warning build.
- Existing private Windows frontend gate passed **Plugin SDK build**, including shared package TypeScript build and verified legal notice copies. The **full UI TypeScript `tsc -b` is NOT qualified**: it previously failed resolving `@bostan/adapter-utils` from the isolated worktree; the specific missing adapter dependency junction was subsequently fixed but that full expensive typecheck has not yet been rerun.
- Existing cross-platform Windows UI qualification static/negative tests: **5/5 PASS** on native Windows and Mac for no-cloud, no-release, Playwright origin and preview-owned teardown.
- Existing actual `pnpm --filter @bostan/ui exec node scripts/bostan-preview-browser-smoke.mjs` against the production build: **exit 0 in 11.23s**, loopback HTTP `200`, HTML title `Bostan`, visible identity `Bostan`, **0 browser JavaScript errors**, **0 external browser requests**, and **`BOSTAN_PRIVATE_UI_OWNED_PREVIEW_CLOSED=true`**. Visible offline screen was *Reconnecting to Bostan* because this first-paint test intentionally has **no backend or PostgreSQL**. This is not an authenticated browser UI journey.
- Independent read-only Windows cleanup: zero B144-owned node.exe, zero postgres.exe, tracked Git sources clean.

## QA-only hardening in this PR

`ui/scripts/bostan-preview-browser-smoke.mjs` now forwards only a fixed OS-loader/temporary environment and safe `CI`/`DO_NOT_TRACK`/`OTEL_SDK_DISABLED` into the localhost preview, rather than inheriting model/provider tokens or cloud settings. It waits for the **actual owned Vite preview child `close` event** after SIGTERM, has a bounded fallback that fails the qualification if force-kill was needed, and reports the exact cleanup result. Existing browser test keeps service workers disabled, blocks external origins and checks all browser JS exceptions. Added regression test in the existing Windows UI-gate Node suite.

## Remaining release NO-GO

Windows authenticated Chromium signup/first-admin/member UI **with actual packed Bostan server and PostgreSQL** is still pending, as is a rerun of the UI semantic typecheck after dependency repair. B1-46 had separately passed native Windows packed server+Better Auth+PG HTTP (18 receipt stages); B1-47 passed two sequential native Windows PG teardown cycles; neither is a combined Windows Chromium-to-backend E2E. Also outstanding: concurrent multi-suite PG cleanup, actual zero-cost offline agent task, native Windows/Linux installers, security/privacy/license/provenance audits and end-user acceptance. No publish, release, npm pack, GitHub Actions activation, main merge, paid model or real customer data.
