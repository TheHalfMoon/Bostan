# B0-70 — Bundle the actual upstream Inter 4.1 OFL text through the private Bostan app

**2026-10-27.** Private stacked Draft on B0-69 PR #218 (`f176772baa55b1d1126da62677e9a51d602db1f6`), base product identity Bostan. Do not merge into `main`, publish, deploy, enable inherited GitHub Actions, call paid models, or use customer data.

## Gap found

The UI bundle ships Inter Variable and Inter Variable Italic WOFF2 fonts. The existing source `ui/public/fonts/NOTICE.md` correctly named **SIL Open Font License 1.1** and linked to its original upstream license, but did **not** include the actual full Inter copyright/license text as a first-party packaged file. Paper Mono already had a separate `PaperMono-OFL.txt` in the UI. A clickable URL is not the same as distributing the original license text together with the offline packaged font.

## Changes

- Added `ui/public/fonts/Inter-OFL.txt`, obtained **without modifications** from the pinned upstream Inter v4.1 official source: `https://raw.githubusercontent.com/rsms/inter/v4.1/LICENSE.txt`. The file includes the original **Copyright (c) 2016 The Inter Project Authors**, OFL v1.1 permissions/conditions, termination and disclaimer.
- Source file **4,380 bytes**, SHA-256 **`262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a`**. The Bostan read-only font gate now pins this complete text digest and requires the original copyright and canonical OFL headings.
- Updated `ui/public/fonts/NOTICE.md` to identify `Inter-OFL.txt` as bundled verbatim; the official upstream URL and Inter/Paper Mono vendor identities remain intact.
- Extended `--verify-stage <absolute-ui-dist>` from B0-69 to require **three legal files** (`NOTICE.md`, `PaperMono-OFL.txt`, and `Inter-OFL.txt`) as real independent, unmodified, byte-identical copies in the compiled/relocated UI.
- Regression tests now reject a damaged/missing/intercepted Inter license or missing original copyright in source/staged form.
- No WOFF2 or unrelated binary changed, no dependency/lockfile version changes, no rebranding of real external vendors or deletion of any upstream MIT copyright.

## Actual qualification evidence

**Source/fixture tests on the exact B0-70 code `95f78fc`:**

| Environment | PASS | FAIL | SKIP | Notes |
| --- | ---: | ---: | ---: | --- |
| macOS arm64 / Node 26 | 11 | 0 | 0 | Bundled/source/staged license and private app source guard |
| Windows 11 native / Node 24.19 | 10 | 0 | 1 | Native font tests ran; Mac/Linux Bash execution test intentionally skipped |
| Linux Ubuntu x86_64 WSL2 / official Linux Node 24.19 | 11 | 0 | 0 | Same exact source/fixture tests with actual Linux binary |

**Actual Mac arm64 compiled and relocated private Bostan app:**

```sh
bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated
```

- Frozen/offline dependency install, compiled server, UI production build and private production-stage deploy completed, no paid inference.
- Original-stage and relocated-stage `bostan.private-staged-ui-font-license.v1` checks both **PASS**: `stagedBoardFonts=3`, `stagedLegalFiles=3`, `byteIdenticalAssets=true`, `fullDependencyLicenseAuditComplete=false`.
- Real isolated PostgreSQL migrated and private loopback HTTP returned **200**, health OK, auth ready, no external models.
- Chromium private Bostan initial paint passed: **0 JS errors, 0 external requests**; production browser modules present.
- Synthetic CRUD passed: **two companies, two issues, 13 HTTP requests, 0 remote model calls**, rejects invalid inputs.
- **`BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`**, **`CLEANUP_COMPLETED exit=0`**, overall **EXIT 0** (~147s). No user files or personal databases were touched.

## Limits

Bundling Inter's full OFL text improves redistribution readiness for **the identified Inter fonts**, not full legal clearance for other fonts (e.g. issue-thread subsets), other packaged binaries or all software dependencies. The precise third-party license review and complete Windows/Linux installed app, real governed free-model agent effectiveness and independent security assessment remain **OPEN**. Do not infer release readiness from a staged Mac pass. **Bostan release NO-GO**.
