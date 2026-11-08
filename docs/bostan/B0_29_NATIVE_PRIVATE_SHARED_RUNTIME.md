# B0-29 — Native private Bostan Shared and Adapter Utils

2026-10-27. Stacked above Draft PR #177. Private source engineering only; no merge, release, deployment, paid inference or inherited CI enablement.

Converted the high-fanout core packages `@paperclipai/shared` and `@paperclipai/adapter-utils` into `@bostan/shared` and `@bostan/adapter-utils`. Both manifests are `private`, remove inherited `publishConfig`, advertise `TheHalfMoon/Bostan` ownership and fail closed on `prepack` and `prepublishOnly`. Both now fall outside the inherited public release inventory. Updated literal package specifiers/imports in 2,532 tracked owned active-code files, including the server, CLI, UI, tests, adapters, scripts and focused documentation. Historical legal LICENSE/PROVENANCE, third-party `cliplab` internals, existing saved protocol keys, changelogs and project progress receipts were not mass-rewritten.

Frozen `pnpm-lock.yaml` importer links regenerated offline. A filtered no-script install of server + 12 adapters + new Shared and Adapter Utils passed with no paid services. Both core packages build with TypeScript 7.0.2; all twelve Bostan agent adapters re-passed their `typecheck` scripts. The Bostan identity/release/shard suites passed **64/64**, and the added two-core identity/lockfile/disabled-release tests passed **4/4**. `node scripts/release-package-map.mjs check` and `git diff --check` passed. Prior Hermes behavioral suite results from B0-28 were 173/173 plus 3/3 shim tests; they are not counted as rerun for this wave.

### Remaining gates

The app still has two core legacy npm identities: `@paperclipai/db` and `@paperclipai/paperclip-runner`. Full server production build, complete UI TypeScript and installed Windows/macOS/Linux E2E, persisted data migration compatibility and independent security + model-authored evaluation have **not** been qualified by this wave. Package scope changes require review of installed user data and distribution migration before any future release. **Release NO-GO.**
