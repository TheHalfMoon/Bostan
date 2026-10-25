# B6-15 — Read-only native Windows qualification-host preflight

Bostan private source development. No main merge, public release, deployment, GitHub Actions, paid resources, software installation, user-file deletion or closing unrelated apps.

## Actual problem and delivered scope

The Mac source runner has passed disposable PostgreSQL + Chromium tests but the full server TypeScript process previously SIGKILLed under heavy memory pressure on an 8-GiB Mac. The Windows device has Node and Git but resource constraints; it has NOT passed an installed Bostan/Chromium/Postgres qualification.

B6-15 provides a dependency-free read-only source QA host probe:

    node scripts/bostan-windows-host-readiness.mjs

It checks native Windows x64/arm64, Node >=24.11, total and currently free RAM, and free space for the user's home/staging and TEMP filesystem using statfsSync. It never creates a file, installs or modifies packages, enumerates installed apps, closes processes or calls external inference. Its fixed JSON contains NO usernames, private paths, account data, installed software, credentials or model output. The CLI returns 1 when a prerequisite is blocked and 2 for invalid arguments.

The JSON always reports installedAppQualified=false and releaseQualified=false even when hostCapacityReady=true.

## Validation-runner resource budget — NOT minimum app requirements

The heavyweight full-compiler + installed browser/Postgres QA target conservatively needs total RAM >=12 GiB, FREE RAM >=6 GiB, and staging and TEMP volumes each reporting >=12 GiB free. Shared staging/TEMP filesystems report their same free capacity. These are assumptions specifically for conducting resource-intensive release qualification without exhausting the machine, NOT published minimum hardware requirements to use Bostan.

## Actual native evidence — 2026-10-26

- Bostan broad Mac Node source suite: 142 PASS, 0 FAIL, 9 Windows-only SKIP (151 cases).
- Actual connected Windows Abdulaziz: fetched only two exact private source files into a new disposable TEMP folder. All 7 native Node tests passed, including positive and negative resource cases.
- The actual Windows CLI ran read-only and correctly returned exit code 1: free RAM, staging disk and TEMP disk did not meet the conservative qualification-host budgets. Native OS, architecture, Node runtime and total RAM checks passed. Neither installed app nor release was marked qualified.
- The source TEMP folder was removed. No full source checkout, dependency/model install, data clearing or extra provider call.
- Mac CLI intentionally fails closed when asked to qualify Windows.

## Open release gates

Adequate Windows host headroom or a separate qualified machine is required before heavyweight installed-app/full server compiler tests. Do not arbitrarily delete files or kill user applications to meet an engineering target.

Successful B5 first model-driven agent Done with exact run-owned receipt, second independent reviewer with source citation, native Case approval, full server typecheck, installed Windows Bostan/installer, end-user browser and independent security remain OPEN.

Repo PRIVATE, inherited Actions disabled, Draft/unmerged. Release NO-GO.
