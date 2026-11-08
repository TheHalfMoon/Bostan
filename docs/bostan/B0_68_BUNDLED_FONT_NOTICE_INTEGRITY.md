# B0-68 — Bundled font notices and upstream copyright integrity

**2026-10-27.** Stacked private Draft on B0-67 PR #216 (base commit `4b56fcbc832147283fd294473d19dd3adcfee70c`). Repository PRIVATE, GitHub Actions disabled, all branches Draft/unmerged; no release, no package publication, no deployment, no paid inference, no customer data.

## Why this phase matters

B0-65/66 ensured all 48 first-party package manifests are Bostan-named and private, but a source-only rename must **not erase or silently change legally required third-party copyright/license notices**. Bostan bundles both UI fonts and issue-thread graphics fonts. The existing notes identify original font vendors and upstream license families, but there was no automated asset/notice integrity gate to catch a changed or newly added binary font that had not undergone an attribution review.

## Scoped product and legal-identity fixes

- `ui/public/fonts/NOTICE.md` now says **Bostan bundles Inter**, retaining the actual Inter and Paper Mono upstream source/version/license provenance and `PaperMono-OFL.txt` reference. **Paper Mono is the external font's actual name**, not product branding to replace.
- `packages/plugins/examples/plugin-kitchen-sink-example/package.json` description now says **Bostan plugin surface**. It remains private; the `paperclipPlugin` compatibility metadata key is deliberately unchanged.
- The root MIT `LICENSE` retains **Copyright (c) 2025 Paperclip AI** and all license conditions, including retention of the notice; this required source attribution is intentionally not rebranded.
- ClipLab source license retains the **Jérémy Perret** and **Tonio** copyright credits, and its source provenance remains intact.
- The issue-thread font NOTICE retains the **Bitstream** license notice, original vendor descriptions, and references to Inter/Noto SIL Open Font License.

## Automated read-only integrity gate

New `scripts/bostan-private-bundled-font-inventory.json` pins SHA-256 digests for **eight** existing WOFF2 assets (three UI board fonts; five issue-thread fonts). Each entry is tied to a recorded license family and its exact NOTICE file.

New `scripts/bostan-private-bundled-font-license-gate.mjs`:
- Performs no network calls and mutates no source; default mode is `--plan`, explicit qualification is `--check`.
- Rejects missing, altered, symlinked, hard-linked or unaccounted binary assets, incomplete notice text, removed upstream copyrights, altered known license statements and identity regressions.
- Checks the exact asset inventory against both physical bundled-font directories to prevent a **new unreviewed WOFF2 file** escaping the inventory.
- Returns `fullDependencyLicenseAuditComplete:false` and `releaseQualified:false`; this explicitly does **not** claim legal completion of all npm, native binaries, generated assets, embedded upstream sources or third-party licenses.

The inventory pins source bytes, **not a legal conclusion** that an upstream font supplier legally approved the project. Licenses and redistribution terms still require formal source/package-specific review before release.

## Real three-platform verification at source head `6ddecb3`

| Platform | Toolchain | Tests | Executed result |
| --- | --- | --- | --- |
| macOS ARM64 | Node v26.0.0 | Font NOTICE + registry inventory tests | **9/9 PASS**, exit 0 |
| Native Windows 11 | Node v24.19.0 | Same unchanged source / SHA-256 font assets | **9/9 PASS**, exit 0 |
| Ubuntu Linux x86_64 WSL2 | Official Linux Node v24.19.0 | Same unchanged source / SHA-256 font assets | **9/9 PASS**, exit 0 |

All three reported `bostan.private-bundled-font-license.v1` with `passed:true`, `bundledFonts:8`, `boardFonts:3`, `issueThreadFonts:5`, `noticesPreserved:2`, `sourceCopyrightPreserved:true`, `releaseQualified:false`, `fullDependencyLicenseAuditComplete:false`, `paidProvidersUsed:false`. Explicit negative tests verified that synthetic tampering, removed attribution, missing inventory entries, duplicates, wrong notice and unknown arguments fail closed. No test deliberately changed, replaced, copied or published a real bundled font.

### Reproduction

```sh
node scripts/bostan-private-bundled-font-license-gate.mjs --plan
node scripts/bostan-private-bundled-font-license-gate.mjs --check
node --test scripts/bostan-private-bundled-font-license-gate.test.mjs scripts/bostan-private-workspace-registry-gate.test.mjs
```

## Open release blocks

This gate covers the **identified bundled WOFF2 font subset** and specific legal notice preservation, not all bundled assets or runtime dependency licenses. Eight private internal package manifests still lack explicit license fields, which require contextual classification rather than guessed SPDX values. Native Windows installed application, Linux full server/UI/runner qualification, real no-cost agent completions, package binary/source inventory, independent legal/security assessment and release readiness remain **OPEN**. **No publication.**
