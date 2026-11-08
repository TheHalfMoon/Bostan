# B6-02 — Local-first connector broker enrollment and redirect guard

**Private development draft only. No release, deployment, main merge, Actions, or paid services.**

## Observed inherited behavior

The Connections page always queried enrollment status and showed an inherited Cloud enrollment CTA even when the Bostan broker was explicitly disabled. It navigated to response-provided verification URLs without an independent browser-side exact-origin check. The server already enforces an explicit, non-upstream HTTPS Bostan broker policy; the UI was not yet applying that policy.

## Changes

- The inherited enrollment banner is absent when the local API indicates there is no valid explicitly configured private HTTPS broker. Ordinary app connector listings and permission controls remain visible.
- The browser validates an explicit HTTPS broker origin; upstream Paperclip hosts, local addresses, URL credentials, query/hash fragments, ports, and invalid paths are rejected to match the server's Bostan broker contract.
- Pending enrollment navigation is allowed only to that exact approved origin, the exact /connections/enroll route, and one bounded URL-safe id query. External origin redirects, credential tricks, path changes, extra query parameters, fragments, and non-HTTPS URLs are denied.
- Both initial enrollment and a resumed pending enrollment use this same gate. On an untrusted URL, the page shows an error toast, performs no navigation, and does not create a duplicate enrollment request.
- Gated broker copy uses Bostan-neutral language instead of advertising the inherited hosted service.

This is UI defense-in-depth. Existing server-side permissions and the Bostan broker policy are unchanged. An explicitly approved broker remains usable with authorized configuration.

## Mac source qualification, 2026-10-25

- Focused Vitest integration/unit suites: **33/33 PASS** across 2 files, no failures or skips, including malicious URL cases and UI click rejection.
- UI Storybook structure generation + TypeScript tsc -b: **PASS**.
- UI Vite production bundle: **PASS** (existing large-chunk warning, not a deploy).
- git diff --check: **PASS**.

The build does not qualify a packaged consumer app, installed Windows Chromium tests, offline model execution, independent provider action verification, full B4/B5 scenarios or full B6 identity migration. External broker integration itself was intentionally not attempted.

**Remaining release decision: NO-GO.**
