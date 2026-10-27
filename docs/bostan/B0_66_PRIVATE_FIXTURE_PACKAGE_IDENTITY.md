# B0-66 — Private fixture package identity: no inherited donor npm names

**2026-10-27**, stacked private Draft over B0-65 PR #214 at `66689433fd997a38a06f15da12f936d95768e9da`. Do not publish, deploy, merge to `main`, enable inherited GitHub Actions, or contact paid inference.

## Finding and scope

B0-65 ensured every one of the 48 tracked nested `package.json` manifests was private and had no public `publishConfig`. However, **three private internal test/distribution fixture manifests** still identified themselves with inherited donor npm package names. These names are not public Bostan user-facing pages or registered/published npm packages, but they do not satisfy the Bostan first-party naming policy.

This change updates exactly these private manifest identity fields:

| Location | Previous private package name | Bostan private package name |
| --- | --- | --- |
| Runner's PI runtime distribution fixture `packages/paperclip-runner/scripts/pi-distribution/package.json` | `paperclip-pi-runtime-distribution` | `bostan-pi-runtime-distribution` |
| Cloudflare sandbox bridge template `packages/plugins/sandbox-providers/cloudflare/bridge-template/package.json` | `paperclip-cloudflare-sandbox-bridge-template` | `bostan-cloudflare-sandbox-bridge-template` |
| Speko voice proof fixture `tests/speko-voice-proof/package.json` | `@paperclipai/speko-voice-proof` | `@bostan/speko-voice-proof` |

The PI fixture's separately versioned `package-lock.json` root identity and empty importer identity are both updated consistently. Existing pinned third-party dependencies, lockfile integrity entries, package path conventions and executable/runtime scripts are unchanged.

**Preserved:** historical persisted protocol keys, source paths needed by runner imports, supplier attributions and legal notices. This is *not* a blanket source-history removal.

## Regression prevention

Strengthened the read-only B0-65 `scripts/bostan-private-workspace-registry-gate.mjs --check` to require every tracked private internal package to have a Bostan-owned npm name (`bostan`, `bostan-...`, or `@bostan/...`), explicitly check the three fixture names, and require agreement between PI `package.json` and `package-lock.json`. New pure negative tests reject reintroduction of `@paperclipai/fake` or `paperclip-fake` package names. All 48 tracked manifests remain `private:true` without `publishConfig`.

## Real verification on macOS arm64

- Targeted identity/release suite initially **23/23 PASS**; source gate reports **48 private Bostan-owned manifests, 3 fixture identities, 2 disabled catalog publishers, zero publicly eligible release packages**.
- An expanded eight-suite run initially returned **51 PASS, 1 failure**, solely because fresh source checkout lacked the native runner's generated `dist/cli/eval-session.js` build artifact. This failed attempt remains documented; not counted as a green gate.
- Scoped frozen/offline install `pnpm install --offline --frozen-lockfile --ignore-scripts --filter '@bostan/runner...'` completed **EXIT 0**, with zero downloads.
- Actual `pnpm --filter @bostan/runner build:typescript` **EXIT 0**, including ACPX profile checks, schema consistency and use of existing local Copilot runtime assets.
- Expanded eight-suite exact retake: **52/52 PASS, 0 failed, 0 skipped**, exit 0.
- No dependency versions, production API, persistent database schema or root lockfile were changed. No external model or npm registry publication was performed.

## Remaining constraints

Bostan first-party tracked *package names* are consistent, but not every historical source-code identifier, storage protocol identifier, third-party copyright/NOTICE file or printed donor-dependent integration is user-facing and safe to rename. The eight private manifests still lacking explicit license fields (B0-65 report) must be reviewed with underlying supplier license terms, rather than assigning arbitrary SPDX values. Native installed cross-platform lifecycle, free-model agent benchmarks, full notices/security audit and release qualification remain **OPEN**. Product **NO-GO** for publication.
