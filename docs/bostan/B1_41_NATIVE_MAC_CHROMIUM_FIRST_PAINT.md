# B1-41 — Real private Mac Chromium first paint of Bostan Vite production UI

Date: 2026-10-29. PRIVATE, ZERO-COST, NONPUBLISHING. Exact stacked parent B1-40 Draft PR #293 HEAD `e0c7c6f184389d40a484fcd6da546e945e7888ca`.

## Product evidence, not a mocked UI

At the isolated, authorized Mac `~/Bostan-B135-qa` checkout, UI was initially **not built** (`ui/dist/index.html` absent) and no Chromium Playwright browser was installed. System storage was ~17GiB free and RAM >50% free.

- Installed `@bostan/ui...` from public npm under original frozen lockfile with `--ignore-scripts`, no browser auto-install, constrained network, `CI=1`: **489 workspace UI dependency packages**, **install EXIT 0**; no lockfile changes or paid dependencies.
- Actual `CI=true NODE_OPTIONS='--max-old-space-size=3072' pnpm --filter @bostan/ui build`: **EXIT 0**, Vite production assets generated, `ui/dist/index.html` present, ~**22MiB** production UI. Vite warned about a few large minified chunks (an optimization target), not compilation errors.
- Pinned Playwright **1.62.1**; downloaded free browser artifacts only into isolated `$REPO/.qa-playwright-browsers` (`PLAYWRIGHT_BROWSERS_PATH`), **Chrome 151.0.7922.34**, FFmpeg and headless shell. **install EXIT 0**, no system browser change, no global app install; Mac disk ~16GiB remaining.
- First directly executed a real, owned localhost `vite preview` child from the actual `ui/dist`, selected random ephemeral `127.0.0.1` port and called **the existing repository's real `verifyLocalBrowser`** with Playwright. Browser result:
  `{schema:"bostan.staged-private-browser.v1",qualified:true,releaseQualified:false,platform:"darwin",title:"Bostan",bodyPresent:true,externalRequests:0,jsErrors:0,productionModulesPresent:true}`.
  Exact receipt **`BOSTAN_MAC_CHROMIUM_REAL_FIRST_PAINT_PASS`**, test **EXIT 0**. Network interception blocked any attempted non-local browser request, and the owned preview child closed.

## Reusable CLI implemented and reverified

New **`ui/scripts/bostan-private-built-ui-browser-qa.mjs`** provides repeatable opt-in `--plan` (read-only) or `--run` (real browser) with:

1. Mac-only, exact `Bostan-B###-qa` checkout basename, private Bostan repository identity, existing real Vite `ui/dist/index.html` (not a symlink), pinned local Vite executable, isolated existing Playwright browser directory.
2. Direct Node child `vite preview` spawned as **one owned process** with no inherited cloud/model credentials; only localhost address, random ephemeral port, strict-port mode. Readiness is bounded; no public host, deployment, npm pack, or source fallback.
3. Actual browser checker `verifyLocalBrowser` demands Bostan document title, visible body, production hashed JS module, **zero page JavaScript exceptions**, **zero external browser network requests**.
4. Cleanup in `finally`: terminate the exact owned preview process, bounded wait, then forced termination of that handle only if necessary. Return nonzero on failed browser or uncertain child exit; never operate on other user processes.

**Reproduced at exact source head `09268511da2f0ea885ce163cdc9efaf034523536`:** `node --check` PASS, `--plan` returned no-run JSON, `node ui/scripts/bostan-private-built-ui-browser-qa.mjs --run` **EXIT 0 in ~10.63s**, `BOSTAN_PRIVATE_UI_VITE_PREVIEW_HTTP_200`, same proof JSON with zero errors and zero external requests, `BOSTAN_PRIVATE_MAC_CHROMIUM_FIRST_PAINT_QUALIFIED`, `BOSTAN_PRIVATE_UI_OWNED_PREVIEW_CLOSED=true`, source worktree tracked diff empty.

## Honest scope / release NO-GO

These browser checks are the production **UI files through local Vite preview**. They are NOT an authenticated browser session against a full real backend. The separate B1-40 **real SHA256-owned packed server + PostgreSQL + Better Auth** qualified 43 API requests on Mac; neither test alone or combined proves the complete browser-to-server signup/admin/company journeys. Native Windows packed app still fails 180-second health startup; issue #237 full native 18-stage auth and #234 PG multi-suite process proof remain open. Still require genuine free offline agent execution, Windows/Linux/macOS installers, UI login workflow, privacy, full typechecks, security/license/NOTICE and release gates. No publishing/deploy, GitHub Actions enable, protected-main merge, npm pack, external AI/model calls or customer data. **NO-GO**.
