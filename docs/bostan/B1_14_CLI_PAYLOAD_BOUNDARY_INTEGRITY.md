# B1-14 — Bind local Bostan CLI integrity to file boundaries

Date: 2026-10-29. PRIVATE, zero-cost, Draft-only, nonpublishing. Stack on B1-13 PR #265, exactly `4d02b9728c54aa244723392ff17a88753b11cbf2`. No main merge or release.

## Native Windows false green, reproduced before code changes

The existing local installer used `sha256(Buffer.concat([...files.values()]))` both to identify its installed source payload and to validate the installed payload against the manifest. Because no filename or length was hashed, shifting any bytes from the end of one file to the start of its immediate successor preserved the combined concatenation and therefore the original digest.

A new synthetic Windows 11 Node.js 24.19 test installed Bostan in an owned, disposable `bostan-native-install-test-*/home` below the real user TEMP root, subject to the existing private NTFS ACL admission. It moved the last byte of installed `dist/bostan.js` to the beginning of `dist/bostan-local-install.mjs`, then proved that the old combined digest remained the same. **Before repair**, `statusLocal(home)` returned success; the new test failed with **Missing expected exception**. No user install, network provider, customer data, background service or actual Bostan production database was involved.

## Repair

- Define `payloadDigest(files)` as SHA-256 over a dedicated `bostan-native-local-payload-v2` domain and each ordered file's byte-counted **name, exact content length and content**. The installed manifest validator hashes the same fixed list by filename and content rather than a concatenation of anonymous bytes.
- New local installations emit `schema: 2`. An existing Bostan `schema: 1` manifest with the expected first-party marker fails read-only inspection explicitly as **legacy and unverifiable**. No automatic adoption, migration, override, deletion, or publication of existing CLI data is permitted. A new independently verified local installation would require a separate empty HOME; original user data is retained for manual migration planning.
- Add regressions for the deterministic cross-file shift and for a legacy manifest's refusal **without modifying either the manifest or the installed entry**.
- Register the new integrity suite with the existing `cli/package.json` `bostan:smoke` target. Production app server, installed CLI command surface, PATH, and release policy remain unchanged.

## Actually executed

On a private isolated Windows 11 checkout `D:\\Bostan-B111-qa`, Node.js 24.19.0:

1. The **exact new boundary regression FAILED before repair** because modified installed bytes passed status.
2. `node --check` of implementation and regression tests PASS.
3. After repair, the focused integrity and preview tests: **8 tests, 8 PASS, 0 FAIL/SKIP**.
4. `node cli/scripts/build-bostan-preview.mjs`: PASS, without downloads.
5. Full local preview/installer/integrity `node --test --test-reporter=tap --test-concurrency=1` across all 3 smoke suites: **23 tests, 20 PASS, 0 FAIL, 3 SKIP** (57.05s). Included native Windows guarded temporary installation, real CMD shim invocation, read-only status, modified payload denial, correct snapshot/ZIP inspector, blocked legacy commands, refusal of broader ACLs and real-profile installs.

Build output is local and not a published npm artifact. This validates local CLI preview integrity, **not** complete Bostan product functionality. The source/compiled server, actual embedded PostgreSQL, 18-stage real authenticated HTTP, agent task and Chromium were not run by this wave. macOS/Linux replay of the new v2 manifest remains pending.

## Remaining gates and restrictions

Issues #234 (Windows PostgreSQL orphan workers) and #237 (fully booted source HTTP/Chromium) remain open. The parent Bostan project requires cross-platform product E2E, real free agent task, reproducible installer/source qualification, privacy/security/license review and backup recovery validation. Free RAM on Windows had fallen below the >=2 GiB heavy-test admission during the session; do not bypass. Keep Bostan PRIVATE, GitHub Actions OFF, Draft PR only, release **NO-GO**, no protected-main merge, deployment, registry/npm publish, customer data, paid model or cloud provider, and no interference with other projects or existing installations.
