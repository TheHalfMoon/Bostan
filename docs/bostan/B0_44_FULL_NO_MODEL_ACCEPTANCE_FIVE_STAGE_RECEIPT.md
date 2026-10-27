# B0-44 — Complete five-scenario native Bostan source acceptance, one-command proof

2026-10-27. Private stacked Draft PR above B0-43, source head `6379dab5510faf7fdfd0a12e1dc334bc410a5f17` at qualification start. No `main` merge, publication, deployment, paid-model use, or inherited GitHub Actions enablement.

## Actual macOS source execution

Installed frozen pnpm workspace dependencies from **local offline cache** (`--offline --frozen-lockfile --ignore-scripts --filter '@bostan/ui...' --filter '@bostan/server...'`), built real `@bostan/plugin-sdk`, real `@bostan/runner` **TypeScript only** and `@bostan/ui` production Vite bundle, and confirmed `node cli/src/bostan-preview.mjs app doctor` reported source prerequisites satisfied. PostgreSQL 17 CLI tools and cached Playwright Chromium were present. No native Rust compilation and no model provider enabled.

Executed on authorized macOS arm64:

```bash
node scripts/bostan-no-model-acceptance.mjs --run all
```

**Actual exit status 0, all five in order PASS**, in one process supervising five independent disposable Bostan application + PostgreSQL instances (duration ~119 s):

1. `persistence`: private HTTP health, synthetic company creation, clean stop, app restart, exact persistence check and clean stop — PASS.
2. `onboarding`: real headless Chromium against live Bostan HTTP, new company wizard — PASS. Browser exceptions 0; blocked outbound requests 0.
3. `inactiveAgentDraft`: same real browser flow with paused first-agent draft and adapter selected/still paused, no inference — PASS. Browser exceptions 0; blocked outbound requests 0.
4. `coldRestore`: real PostgreSQL cold backup verification and restore into **different temporary HOME**, 3,420 files verified, restart and browser check — PASS. Browser exceptions 0; blocked outbound requests 0.
5. `taskInsightsPrivacy`: real browser task insights, route-scoped issue code bundle and HTML no-referrer contract — PASS. Browser exceptions 0; blocked outbound requests 0.

No lingering Bostan test server processes after the suite. No real customer data, internet model requests, uploads, publication or deployments. Raw host logs are not committed.

## New reproducible audit receipt

Added read-only validator `scripts/bostan-no-model-acceptance-receipt.mjs`:

```bash
node scripts/bostan-no-model-acceptance.mjs --run all > /tmp/bostan-acceptance.log 2>&1
node scripts/bostan-no-model-acceptance-receipt.mjs --check-log /tmp/bostan-acceptance.log
```

It validates the **full ordered five-stage receipt**, one `qualified:true` scenario result per stage, the scenario-specific actual `verified` evidence, real-browser zero-exception/zero-external request counters, positive file count + restored-to-new-HOME for cold recovery, one final batch marker, absence of failure diagnostics and single-platform consistency. It rejects oversized logs, missing/duplicate/out-of-order or synthetic-error stage reports. No network, models, source mutations or registry access are performed.

Verified on the *actual* private raw Mac transcript:

```json
{
  "schema": "bostan.no-model-acceptance-receipt.v1",
  "releaseQualified": false,
  "allFivePassed": true,
  "platform": "darwin",
  "scenarios": ["persistence", "onboarding", "inactiveAgentDraft", "coldRestore", "taskInsightsPrivacy"],
  "coldRestoreFiles": 3420,
  "browserPageErrors": 0,
  "externalRequestsBlocked": 0,
  "nativeRustQualified": false,
  "installedWindowsQualified": false,
  "realModelQualified": false
}
```

Receipt parser tests + prior source acceptance harness tests: **9/9 PASS**. This is source-functional acceptance only, **not release qualification**. Full native Rust build, actual installed Windows/macOS/Linux package integration, independently proven real free-agent tasks and cross-provider model evidence, security and legal review remain open. Windows machine had insufficient free RAM/disk for the 12 GiB staging/temporary and 6 GiB RAM gates. **Release NO-GO.**
