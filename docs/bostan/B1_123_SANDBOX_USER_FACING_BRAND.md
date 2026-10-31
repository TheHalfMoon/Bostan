# B1-123 — Bostan identity in sandbox proxy diagnostics and resources

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, DRAFT, UNMERGED, ZERO COST, NO RELEASE.**
Stacked directly on B1-122 private Draft PR #378, exact head `c341ad69111f7fe8c45ee7bd012551c40bc02125`.

## Scope and rebrand decision

The Bostan sandbox code still exposed the donor product name in six runtime diagnostic strings and in the network proxy's temporary directory prefix `paperclip-network-sandbox-`. Examples included the HTTP proxy's 400 invalid-URL error, 400 HTTPS-requires-CONNECT error, 403 denied-target error, CONNECT denied-target message, and local proxy socket/path initialization failures. Those messages are product-owned UI/API surfaces, unlike original upstream copyright and licensing notices.

We changed only `packages/adapter-utils/src/local-process-sandbox.ts` and its co-located tests:
- Seven source occurrences of `Paperclip` or `paperclip-network-sandbox-` now consistently use Bostan. Existing error **codes**, HTTP statuses, authorization rules, proxy command/port, security logic and API structure are unchanged.
- `NETWORK_PROXY_TEMP_PREFIX` now uses `bostan-network-sandbox-`. Its generated Unix-domain socket path remains bounded using existing Linux checks.
- Existing HTTP negative tests and temporary path assertions are aligned with Bostan's exact user-visible strings and prefix; test-only temporary fixture names are also rebranded.
- Tests now prefer `BOSTAN_TEST_BWRAP` and `BOSTAN_TEST_SANDBOX_BUILD`, while retaining fallback to `PAPERCLIP_TEST_BWRAP` and `PAPERCLIP_TEST_SANDBOX_BUILD` for existing native test runners. These old names are *compatibility variables in tests only*, not product-visible branding.
- The GitHub repository remains private, source tests remain committed and the release remains forbidden.

## Preserved upstream legal notices

Read and verified the exact root `LICENSE` in this PRIVATE GitHub candidate: MIT license, includes `Copyright (c) 2025 Paperclip AI`, and requires preserving the permission/copyright notice in copies/substantial portions. **The original `LICENSE` was NOT modified or renamed.** Root `NOTICE` was not found at this exact ref, but MIT alone does not imply that a separate NOTICE document is mandatory. This limited root-file check is not a complete legal audit of vendored assets, package-level licenses or provenance; third-party compliance stays a release gate.

## What was verified, and what was not

1. Fetched exact parent source/test files before patch; counted exactly **7** donor runtime occurrences in the source, **3** human-readable `Paperclip` cases in tests, plus legacy fixture names/variables.
2. After test-first commit `b14ef8fe320db5a9e24721463846c12951e41f96` and code commit `c29600a718a937ec64bd6d44315b9e875083712c`, fetched full files from GitHub. Confirmed **zero `Paperclip`/`paperclip-` occurrences** in production sandbox source and zero old donor product strings in sandbox tests; the only intentionally retained `PAPERCLIP_TEST_*` references are the two test-only compatibility fallbacks.
3. Verified all Bostan proxy-error strings and Bostan network socket prefix against test expectations in the fetched committed files, including the denied-host response body and `/tmp/bostan-network-sandbox-` prefix.
4. Verified unmodified root `LICENSE` still includes the upstream MIT copyright notice; no license removal or new publication.
5. Re-pinned the fail-closed private Linux 4-suite QA gate `scripts/bostan-private-linux-sandbox-gate.sh` to the exact fetched Git blobs: source `8274f932aac8699b112d6e53d9189596e2a28059`, tests `d0d4b391fad3f5f10379c71e091f367b25299eb1` (gate pin commit `aaf1eb9554aa8155750d40f70db2e7b827e83f83`), and refreshed `docs/bostan/B1_112_LINUX_SANDBOX_SOURCE_NATIVE_GATE.md` at `5f5b17b62f0742cf67a615674d6880b3b0dde579`.

**Test limitations:** This round performed source-and-expectation assertions against actual private GitHub files, not source-native Bostan Vitest/TypeScript7 or bubblewrap. No remote desktop was contacted: the connector previously reported its monthly quota exhausted and instructed not to retry. The model-side container has Node22 and no authorized Bostan checkout/rootless bubblewrap. Do not claim platform qualification.

## Remaining mandatory qualification

Actual Linux four-suite Vitest, adapter-utils TypeScript7 and rootless bubblewrap at this exact private PR head; Linux sandbox and bridge tests; installed Win/macOS/Linux products; governed agent effects/consent, tenant privacy and security, real sustained PostgreSQL stress (issue #234), third-party license/provenance package-by-package and full rebrand inventory. Keep PR private Draft/unmerged, main untouched, Actions disabled, no publishing/release/deploy/npm pack/paid services/customer data/unowned cleanup.

**Overall Bostan RELEASE: NO-GO.**
