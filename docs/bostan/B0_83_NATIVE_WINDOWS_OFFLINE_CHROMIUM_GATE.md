# B0-83 — Native Windows offline Chromium first-paint qualification

**2026-10-28.** Private stacked work on B0-82 PR #231. Keep Bostan PRIVATE, GitHub Actions OFF, all changes Draft/unmerged, no product release or deployment, no paid inference or customer data.

## Scope

B0-82 proved that the production frontend compiles on native Windows 11. This wave adds an explicitly opted-in, dependency-reusing Chromium first-paint gate on the same native Windows host, without asserting full application/server or agent qualification.

- The Windows UI gate's default and --plan remain read-only. Existing --run still builds SDK, typechecks UI, builds production assets and verifies output.
- New --run-browser runs the same full build gate, then executes the existing ui/scripts/bostan-preview-browser-smoke.mjs using preinstalled Playwright Chromium against a local Vite production preview bound only to 127.0.0.1.
- The browser smoke now creates a fresh Playwright context with serviceWorkers:'block' and installs its external-origin filter at context level. Page-only routing could miss traffic routed through service workers. It waits up to 15s for the **actual Bostan-branded DOM state**, rather than any nonempty transitory loading text; checks HTTP 200, visible Bostan identity, no visible inherited Paperclip branding, zero uncaught JS errors, and zero intercepted external requests.
- --run-browser is opt-in and no browser download, third-party AI, database, release/install or publishing commands are added. Existing --run remains browser-free.
- The exact Playwright headless Chromium binary is now launched/closed in a sanitized, bounded preflight **before expensive compilation**; a missing or version-mismatched cached browser fails closed with a sanitized message.
- The UI gate's Node minimum now matches the project's >=24.11.0 engine policy rather than accepting every Node 24 minor.
- The only new evidence marker is BOSTAN_WINDOWS_OFFLINE_CHROMIUM_FIRST_PAINT_PASS, emitted only after the browser smoke returns exit 0.

## Tests / receipt

- Mac ARM64 Node 26: targeted gate, Windows host readiness, and legal-notice unit tests: **14/14 PASS**; node --check and git diff --check PASS.
- Windows 11 Abdulaziz, Node 24.19.0/pnpm 9.12.0, separate D: Bostan-B083-qa checkout on exact branch: same **14/14 native source/security tests PASS**.
- Windows 11 frozen-lockfile --ignore-scripts scoped install for @bostan/ui... and @bostan/runner...: **918/918 packages, exit 0**, using distinct D: store and temporary directories, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1. An expected nonfatal SDK bin-link warning occurred before the subsequent explicit SDK build.
- First actual native Windows --run-browser: SDK, TypeScript, Vite build and Bostan assets **PASS** (516 JS/3 CSS), but Chromium smoke **FAILED exit 1** before page navigation: installed C: Chromium cache revision 1243 did not satisfy Playwright's required headless-shell revision 1234. No browser qualification claimed. Downloading the pinned free browser into a disposable D: cache for exact retake. This explains the newly added early browser preflight.
- Installed the exact Playwright-pinned Chromium headless shell revision 1234 into isolated D: B0-83 browser cache (free/public download). First browser-only run **FAILED** on an unbranded interim loading message; second diagnostic run **PASS** (HTTP 200, visible 'Reconnecting to Bostan', zero JS errors, zero external requests). The browser smoke now waits specifically for Bostan visible text to eliminate this asynchronous first-paint race.
- Native Windows Chromium **final retake pending**. Do not count this gate as qualified without its positive marker and exit 0.

## Explicitly not qualified

The local Vite preview is static UI only. It is not the authenticated Bostan backend or PostgreSQL, and no task was completed by an AI agent. Native Windows installed desktop, signed package, production Cloud independence, security/licensing audit, database backup/restore and real agent completion remain OPEN. **Overall release NO-GO.**
