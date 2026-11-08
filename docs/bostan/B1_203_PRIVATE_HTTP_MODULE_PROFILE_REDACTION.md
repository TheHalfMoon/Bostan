# B1-203 — Private Windows HTTP module profile diagnostic redaction

## Scope

Private test runner only: `scripts/bostan-private-windows-live-http.mjs`. No production server, PostgreSQL lifecycle, authentication, release, or installer behavior changed. The runner accumulates up to 64 KiB of child stdout/stderr to classify startup failures. Before this patch, the `BOSTAN_WIN_IMPORT_PROFILE=` JSON parser allowed any `module` string starting with `packages/` or `server/src/` to be printed in parent diagnostics. A synthetic `packages/ok.ts\\nPRIVATE_QA_UNTRUSTED_DIAGNOSTIC` value entered the old `BOSTAN_WINDOWS_LIVE_SLOW_MODULES` receipt. This is a source-backed diagnostic trust-boundary gap, not a demonstrated customer-data disclosure.

## Change

`sanitizePrivateWindowsModuleProfile` now projects parsed child diagnostics to bounded nonnegative numeric counters and a maximum of five module labels. It accepts only fixed classifications or canonical, bounded repository-relative module paths with no control characters, traversal components, backslashes, or arbitrary query text. Invalid profiles produce only `BOSTAN_WINDOWS_LIVE_MODULE_PROFILE=invalid`; they never echo raw child values. The diagnostic path remains inside the existing runner failure handler.

## Qualification

- Native isolated Linux Node 22.16.0, dependency-free `node --test scripts/bostan-private-windows-module-profile-safe.test.mjs` equivalent: **7/7 PASS**, zero skips, exit 0.
- Native `node --check` on the isolated exact helper: **PASS**.
- Test-first isolated reproduction using the exact B1-202 filtering expression: **expected RED**, exit 1, untrusted module text accepted.
- Exact GitHub helper blob `8c06527814b2f01d59181a1b31ae20a8a0176233` and test blob `6ccd735f23b17237afe897eb0eeaadec8ba25f8c` match local `git hash-object`.
- Updated runner blob `379544d2399a9c80d039d2e787a0916f386b21d6`: checked import, call inside catch, old raw prefix filter absent, invalid-profile fallback present.

## Limits and safety

No native Windows, compiled server, Chromium, real PostgreSQL, full root TS7/Vitest, or installed three-OS acceptance was executed. The output is bounded diagnostic projection, not process attestation or a solution to release gates #234 or #237. The source runner was not executed on a user device. Remote Desktop Commander quota remains exhausted; retained `D:/Bostan-B212-qa` was not accessed or modified. All local test artifacts were exclusively created for this wave and may be inventoried and removed without touching other QA.

**Release: NO-GO.** This PR must remain private, open, draft, unmerged and stacked on B1-202.
