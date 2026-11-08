# B0-69 — Private staged UI font/NOTICE integrity across build, deployment and relocation

**2026-10-27.** Draft stacked over B0-68 PR #217, base `b885c2291fdcca7c82cfd934f8f05fbbba68a540`. Repository **PRIVATE**, Actions **OFF**. No merge into `main`, release, registry publish, paid AI or real customer data.

## Qualification gap

B0-68 pinned eight WOFF2 sources and their vendor license attribution, but a green **source** integrity report alone did not prove that the UI compiled by Vite and deployed into the isolated Bostan server still included the unmodified fonts **and redistribution licenses**. A changed build/copy task could silently omit a license file or replace a font after the source check passed. Staged runtime qualification previously checked only `ui-dist/index.html`, not the staged font files and notices.

## Code

- Add an opt-in, read-only `--verify-stage <absolute-ui-dist>` command to `scripts/bostan-private-bundled-font-license-gate.mjs`, retaining its default read-only plan and existing `--check`.
- Require a real, unsymlinked `ui-dist/fonts` path, **exactly three expected WOFF2 files**, each a non-symlinked standalone regular file with the approved SHA-256 hash from B0-68; refuse unreviewed extra WOFF2 files.
- Require `NOTICE.md` and `PaperMono-OFL.txt` packaged as non-symlinked standalone files **byte-for-byte identical** to the vetted source licenses.
- Re-run the full source legal/attribution audit before accepting any stage.
- Integrate the source check **before the full build**, then the staged `--verify-stage` **after offline packaging** and **again after the relocated stage is moved**, before running PostgreSQL/HTTP/Chromium.
- Include regression tests for missing or tampered notices, modified/additional fonts, symlink substitution, CLI invalid args, and the presence of **both** stage verification calls.

This verifies the defined Bostan UI font subset **after build**. It is not a complete npm/native/Rust/other-vendor license audit.

## Actual Mac arm64 full-app execution

Executed from the private source checkout with:

```bash
bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated
```

The private offline/frozen installation, compiled server build, production UI build and offline production deployment completed successfully. Stage inspection reported valid required dependency closure, internal links only, 375 SQL migrations, and included UI.

**Both staged font/NOTICE checks PASSED**, each reporting `bostan.private-staged-ui-font-license.v1` with `passed=true`, `stagedBoardFonts=3`, `stagedLegalFiles=2`, `byteIdenticalAssets=true`, `sourceCopyrightPreserved=true`, and `fullDependencyLicenseAuditComplete=false`. The post-relocation stage check also passed.

The same relocated private app then ran real isolated PostgreSQL migration and HTTP server: HTTP **200**, `health=ok`, private localhost, auth ready, no external models. Real Chromium reported `BOSTAN_PORTABLE_STAGED_BROWSER_FIRST_PAINT_PASS`, `jsErrors=0`, `externalRequests=0`. The synthetic company/task CRUD receipt reported two company records, two issue records, 13 requests, and **zero remote model calls**. The stage emitted `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, `CLEANUP_COMPLETED exit=0`; overall **exit 0** (~159s).

## Source and safety test evidence

- **Mac arm64 Node 26**: 11/11 PASS (font integrity and stage-script structural/admission).
- **Native Windows Node 24.19**: 10 PASS / 0 FAIL / 1 SKIP on corrected source. An exploratory run of the preexisting Bash invocation unit initially timed out because Windows `bash` launches WSL; that execution was not a native Windows qualification. Now the actual Bash-invocation unit intentionally skips on Windows, while the remainder of the tests and all staged-font fixture cases **execute and pass** on native Windows.
- **Linux WSL2 official Linux Node 24.19**: **11 PASS / 0 FAIL / 0 SKIP** on the exact corrected source `cc0ea7e`; gate and stage-script checks, exit 0. This is a *source/fixture* qualification on Linux, not a compiled Linux server or UI installer test.
- Real build, private server/PostgreSQL and Chromium tests ran on Mac only; there is **no claim of a Windows native installed app**.

## Boundaries

B0-69 closes a **bundled UI asset-and-license continuity** gap in the private compiled/relocated app. Third-party software dependencies, native binaries, historical source copyrights, public installer signatures, full Linux/Windows server+GUI+runner, and genuinely governed free-model agent task efficacy remain unqualified. A partial pass cannot authorize release. **Product release NO-GO**. Keep all stacked PRs Draft and unmerged.
