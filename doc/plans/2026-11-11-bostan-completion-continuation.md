# Bostan completion continuation — 2026-11-11

Product status: **unfinished; no release acceptance claimed**. The owner asked
for full Paperclip-to-Bostan completion and qualified desktop/agent/data/privacy
journeys. Continue implementation and qualification without routine permission
questions. Publication, deployment, signing, notarization and release tags still
require separate explicit authorization. No paid providers or real user data.

## Baseline and ownership

- Refreshed main: `949046ac9b31d0f0ab54b65804f6faded423f0aa`.
  Bostan CI run `42906745689` completed with all 15 jobs successful.
- Repository visibility is currently public; do not repeat earlier private
  checkbox claims or change visibility. Package publication remains disabled.
- Another engineer owns PR #543 and `D:/Bostan-recon-20261108`. Do not edit or
  switch that checkout. Last inspected #543 head was `03efabc17ca62ab404c5c40ca2efb3f5a9d87332`;
  Linux lanes passed but Windows failed. Do not assume its chmod correction has
  completed compiled-server acceptance. #540 is its unmerged parent.
- #547 was merged after all 15 jobs passed on its reviewed exact head, producing
  main commit `7524763280232f9f15f4b0677568a593433cd426`. Post-merge main CI
  `43030026976` is pending. Only merge reviewed exact heads after all required
  checks pass.

## Active integration

- #547, `work/bostan-config-api`, head
  `6284604dbdf68b05c757f21a8a238d13113fdda1`, integrates #544–#546.
  It contains CLI/UI/server copy, compatible configuration API renames and
  `packages/bostan-runner` source relocation. Earlier PRs are absorbed by this
  integration; do not independently land overlapping stacks.
- Its preceding run `42965374884` at `a3a5ef57` passed 10 jobs and failed five
  server/chat lanes (15 assertions). Seven-file repair updates current message
  expectations and restores the historical Paperclip cloud-provisioning fixture.
  Assertions were not removed; fresh review passed. Focused portability 113 PASS,
  diagnostics/webhook 110 PASS. Native Windows DB-backed suites hit the unchanged
  20-second PostgreSQL setup hook bound and remain unverified locally.
- Replacement run `42970150963` completed successfully: all 15 jobs passed on
  `6284604dbdf68b05c757f21a8a238d13113fdda1`; #547 was then merged.
- PR #548, current branch `work/bostan-adapter-copy`, was rebased onto the
  resulting main and retargeted to main. Final exact-head CI remains required.
  It changes provider diagnostics and permission/schema descriptions, plus their
  existing assertions. AST comparison confirms only Paperclip/Bostan literal and
  template text changed across 21 TypeScript files; control flow, identifiers,
  environment variables, paths, scopes and protocols are unchanged. Fresh
  correctness/parsimony/product review and delta review passed.

## Desktop work

- #542, `work/desktop-runtime`, head
  `ccc2b4ff65ac8a849f972a9834d2bcdc3241a312`, in
  `D:/Bostan-desktop-20261110`. Contains #540 ancestry; reconcile the qualified
  compiled correction before final integration.
- Run `42927771728` failed Windows ACL timeout and Mac stage cleanup after DMG
  construction. Run `42968075324` again failed: Windows timed out at
  `identity_ready`, Mac pnpm deploy attempted `mkdir /Users/private`. Those
  failures remain open pending discriminating native results.
- ACL construction now uses direct .NET constructors throughout under the same
  policy and 15-second bound. Staging uses an owned workspace-local container
  outside builder output. The real builder copy preserves empty dependency
  directories; afterPack verifies hashes, links and executable flags.
- The macOS job now mounts the checksum-verified DMG, installs its app copy,
  detaches the image, performs shared real onboarding/restart assertions, proves
  PostgreSQL exits, removes the owned app and verifies data retention. It refuses
  operator machines and pre-existing state. Windows retains its NSIS journey.
- Local desktop tests: 21 PASS / 1 POSIX executable-bit SKIP; workflow tests
  23 PASS; quarantine and syntax PASS. Independent correctness/product/parsimony
  and security reviews passed. Native run `42971413083` failed Windows ACL
  completion at phase `verified`, Mac afterPack runtime equality, the inherited
  compiled Windows chmod path, and one durable login-cleanup assertion. Direct
  console readiness output is the next ACL repair; Mac mismatch needs bounded
  diagnostic evidence. Neither platform's installer is accepted.
  No installed-app acceptance, real agent execution or OS trust is claimed.
- Read `docs/bostan/DESKTOP_ACCEPTANCE.md` and #542 for detailed failure history.

## Adapter copy evidence and local limits

The first focused five-suite run had 105 PASS / 39 FAIL: Claude POSIX shell
fixtures selected the installed CLI version on Windows, probe expectations did
not reach their intended fixture paths, and sandbox sync rejected native Windows
paths as non-POSIX. Do not claim a clean run or infer infrastructure failure.
The next four-suite run had 167 PASS / 2 symlink EPERM FAIL (Hermes operational
skill linking). The changed credential-boundary scenario separately passed
1 case with 45 unrelated cases filtered out; final diagnostic helpers 19 PASS.
No live provider task was invoked. Full exact-head CI remains required.

Commands (all shell commands on this machine are prefixed with `rtk`):

```sh
rtk proxy gh run view 42970150963 --json status,conclusion,jobs
rtk proxy gh run view 42971413083 --json status,conclusion,jobs
rtk proxy pnpm exec vitest run packages/adapters/hermes/src/gateway/server/execute.test.ts packages/adapters/hermes/src/index.test.ts packages/adapters/claude-local/src/server/probe-diagnostics.test.ts packages/adapter-utils/src/paperclip-runner-permissions.test.ts --maxWorkers=1
rtk proxy npm --prefix desktop test
rtk proxy npm --prefix desktop run test:host
rtk proxy pnpm --filter @bostan/server... --workspace-concurrency=1 build
rtk proxy pnpm --filter @bostan/ui build
rtk proxy npm --prefix desktop run package
```

Run heavy builds serially after checking free RAM. Do not kill unrelated
processes. Capture CI logs to files and print only bounded failure summaries;
some test jobs emit tens of megabytes. Never stream raw full failed-job logs.

## Next executable work

1. Resolve final-head #547/#542 failures and land only qualified reviewed heads.
   Coordinate #543 without duplicating the other engineer's active checkout.
2. Complete actual installed Windows and macOS journeys, update/rollback and
   native compiled-server persistence/cleanup evidence.
3. Complete a genuine zero-cost first-agent task. Ollama's installed small model
   has only had synthetic native inference smokes; that is not Bostan execution.
4. Finish compatibility-aware runtime identity. Existing `PAPERCLIP_*`,
   `.paperclip`, coordination skill names, persisted field keys and protocol
   values remain intentionally compatible. Coordinate all path owners before
   switching defaults; never move or delete user data for cosmetic consistency.
5. Requalify versioned Runner Pi/OpenRouter attribution (#512), preserving pinned
   historical profiles, command digests and receipts. Do not silently edit them.
6. Finish privacy/network capture, backup/restore/crash/update tests, remaining
   prompt/assets/docs branding and reviewed dependency upgrades. Dependabot PRs
   are still open; no blind merges. Real external Paperclip Notebook identity and
   required legal/provenance records must remain factual.

Do not declare the overall goal complete from source CI, a DMG build or deferred
provider onboarding. No recurring background execution is configured; progress
occurs only during active execution sessions.
