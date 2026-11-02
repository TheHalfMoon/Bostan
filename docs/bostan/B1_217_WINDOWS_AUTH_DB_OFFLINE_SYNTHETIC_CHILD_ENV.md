# B1-217 — Native Windows auth/DB child environment value admission

**Private draft only. RELEASE NO-GO.** Parent B1-216 PR #473 exact head 8f974bdf9c236419c83f607d15126c88ee13c579.

## Source-backed issue

B1-216's captured-child helper checked environment key membership, NULs, and Windows SystemRoot/PATH consistency. It did not pin the values of npm_config_offline, PAPERCLIP_TEST_POSTGRES_TEMPLATE, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, CI, or the seven profile/TEMP variables. A future direct helper caller could therefore pass npm_config_offline=false, PAPERCLIP_TEST_POSTGRES_TEMPLATE=1, or an operator HOME and still reach spawnSync. This is a helper-level defense-in-depth defect, not evidence that the existing native runner did so: its B1-209 planner already constructs an explicit offline synthetic environment.

## Change

- For native Windows SystemRoot, require all six pinned safety flags with exact values: CI=1, DO_NOT_TRACK=1, OTEL_SDK_DISABLED=true, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1, NPM_CONFIG_OFFLINE=true, and PAPERCLIP_TEST_POSTGRES_TEMPLATE=0.
- Require HOME, USERPROFILE, TEMP, TMP, APPDATA, LOCALAPPDATA and XDG_CONFIG_HOME to be the same canonical direct-drive Bostan-B###-temp path (case-insensitive Windows spelling); reject UNC/device, traversal, ADS, control characters, reserved names, trailing dot/space, and foreign profiles.
- Preserve minimal PATH-empty synthetic Node tests without SystemRoot, but refuse profile paths and any supplied disabling flags in that mode.
- Preserve B1-214 bounded child stdout/stderr, no shell, no stdin, fixed status receipts, and B1-210 final read-only orphan scan. No process termination, deletion, network access, publication or donor notice changes.

This is a pure string boundary, not filesystem ownership, kernel process attestation, or atomic protection against privileged path swaps. The native runner separately performs B1-211 workspace ancestor and Git checks before subprocess admission.

## Actual isolated verification

Host: Linux, Node 22.16.0. A seven-case new synthetic suite was run against the B1-216 environment validator first: **1 PASS / 6 expected RED**. With the fix, the new seven tests, seven existing captured-child tests (including a real synthetic local Node subprocess and >1 MiB output overflow), and seven existing boundary tests (native valid fixture updated to include required pinned values) yielded **21/21 PASS**, zero skips, exit 0. node --check passed on changed source and tests.

Exact tested Git blobs:
- Captured child helper: fe148af0eff779a9b47682f1eb2d205df830edbf
- New child environment tests: dcaea567b4bb004f5446104816ef490a30bb4e8c
- Updated existing boundary tests: 51967c4abce7987b1580572a6dd9590257a0f35b

## Not qualified

No native Windows Node 24/PowerShell/PostgreSQL 18.1 run, no installed compiled authenticated HTTP/Chromium, no root/server TS7/Vitest, no Linux bwrap or native macOS/Linux PG acceptance, and no installed three-OS E2E. Forced-crash io_worker zero-orphan #234 and real authenticated browser #237 remain release blockers. Remote Desktop Commander monthly quota was not retried or bypassed; retained D:/Bostan-B212-qa and foreign/user QA remain untouched. **RELEASE NO-GO.**
