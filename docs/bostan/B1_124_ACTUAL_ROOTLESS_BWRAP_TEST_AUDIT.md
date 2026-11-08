# B1-124 — Require actual rootless bubblewrap tests before Linux QA can pass

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / ZERO COST / DRAFT / UNMERGED / NO RELEASE.**
Direct parent: B1-123 private Draft PR #379 exact HEAD `c9003434495a9b48600e05e116c61108b31e1b52`.

## Confirmed false-green qualification defect

The existing `scripts/bostan-private-linux-sandbox-gate.sh --run` checked a standalone unprivileged `bwrap --unshare-net` probe and then invoked four real source-native Vitest suites, but **never set** the environment variables that gate the checked-in real bubblewrap tests. In `packages/adapter-utils/src/local-process-sandbox.test.ts` at the parent SHA, three tests use `it.runIf(Boolean(sandboxTestBwrap))`, and the fourth uses `it.runIf(Boolean(sandboxTestBwrap && sandboxTestBuild))`. Those constants prefer `BOSTAN_TEST_BWRAP` / `BOSTAN_TEST_SANDBOX_BUILD` and fall back to legacy environment settings. Without these flags, Vitest can exit successfully while *all four native integration tests are skipped*. The standalone bwrap namespace probe is not evidence that the actual sandbox correctly enforces filesystem or network policy.

The previously at-risk cases are:
- `prevents reads outside the workspace while allowing workspace writes`
- `runs the adapter-utils TypeScript build inside the confined workspace`
- `denies direct network egress`
- `allows only configured network targets through the proxy bridge`

This is a **confirmed qualification-logic bug**, not a claim that a Bostan runtime isolation bypass was observed.

## Fail-closed correction

The updated Linux gate:
1. Confirms that `bwrap` resolves to an absolute existing executable and successfully performs the same 15-second rootless namespace probe. No change to kernel settings or privilege escalation.
2. Runs a new native Node test suite for the JSON audit (`node --test`) before treating any Vitest output as evidence. The audit code and its regression file are protected by frozen HEAD Git blob, clean worktree, realpath/non-symlink and actual on-disk Git hash checks.
3. Launches real existing Vitest with `BOSTAN_TEST_BWRAP="$bwrap_path"` and `BOSTAN_TEST_SANDBOX_BUILD=1` so *all four* integration cases are eligible to execute. The build-in-bwrap test is in addition to the normal package TypeScript7 `--noEmit` check.
4. Generates Vitest's Jest-compatible JSON report using `--reporter=json --outputFile=<owned temporary file>` (the reporter/file CLI is supported by Vitest's documented interface). The only new temporary artifact is a 0600 owner-created JSON file under the configured temporary directory. The gate removes only that file in its exit trap; no installs, downloads, or foreign cleanup.
5. Parses the actual reported results, refusing any missing, skipped, failed, duplicated or absent required integration assertion; refuses missing/duplicated/non-passing results for **all four** named suites and malformed/failed JSON reports. Only successful audit, then successful normal TypeScript package check, may reach `BOSTAN_B112_LINUX_GATE_PASS`. Total Vitest execution is bounded to 600 seconds, per-test 90 seconds and hooks 15 seconds.

### Files and exact checked-in evidence

- `scripts/bostan-private-linux-vitest-report-audit.mjs`: initial commit `34d7a8b82c330807f468ec47f230946dab10f671`, corrected duplicate-diagnostic commit `11261d67b2b3e6bc741da863307f78fae15a2af6`; final Git blob **`eaa2461adfee2599aafad9e470b1c6b0da5e9fa2`**.
- `scripts/bostan-private-linux-vitest-report-audit.test.mjs`: commit `6709bc80295e209f53c16e6d9c0a39e4c5956171`, final Git blob **`0a28db2adcff5169147ef1c5b71246afd462999b`**.
- `scripts/bostan-private-linux-sandbox-gate.sh`: initial B1-124 integration at `e5deb6ce37f66fe0120d4730e94df5a8ff8e7d01`, audit pin correction at `ff2615b0806378802a3a7ef66964ded6899f6ebf`. The already-pinned production source blob stays `8274f932aac8699b112d6e53d9189596e2a28059`, and source-native test blob stays `d0d4b391fad3f5f10379c71e091f367b25299eb1`; neither production code nor tests was modified by B1-124.

## Validation ACTUALLY performed

The model's native Linux environment uses Node `v22.16.0`, no actual private Bostan source checkout, no pre-installed rootless `bwrap`, and no locally installed Bostan Vitest/TypeScript7. Therefore **the full B1-124 source-native gate and the four actual bubblewrap tests were NOT executed**.

Model-side native Node22 validation copied the exact committed audit JS and regression test JS into a temporary self-owned directory, with each local file proven **byte-for-byte identical by Git blob SHA** to the corresponding fetched GitHub source. The first local test execution exposed an audit diagnostic/test expectation mismatch (8/9 pass, 1 failure), which was fixed in the GitHub audit. A fresh model-side execution of the exact corrected Git blob plus the exact unchanged test blob then returned **9/9 PASS, 0 FAIL**, covering allowed passing JSON, failed report, absent suite, skipped suite, skipped rootless test, missing rootless test, duplicate test, duplicate suite and malformed report.

The audited Vitest JSON/reporting CLI and report's `testResults[].assertionResults[].title/status` schema are consistent with Vitest's official JSON reporter documentation. This is **format validation against documentation and synthetic report fixtures**; actual Vitest5 source-native report generation is still UNRUN. The temporary model-side verification directory was removed.

## Compatibility repair: legacy admission synthetic fixtures

The existing `scripts/bostan-private-linux-sandbox-gate.test.sh` creates an owner-contained synthetic Git repository to verify that the fail-closed admission logic rejects Git-hidden source edits, symlink leaves and symlink ancestors. B1-124 now requires both the JSON audit and its own test file to exist with frozen HEAD/worktree hashes, so an unchanged synthetic fixture would be refused **before** reaching its expected Node/dependency admission boundary.

The committed follow-up fixes this without weakening the gate:
- Copy both actual pinned JSON auditor files from the private checkout into **only the synthetic owned Git fixture**, before `git add/commit`. The fixture does not alter upstream files, source code or frozen production/test hashes.
- Extend the fixture's refusal checks to detect modifications hidden by Git `assume-unchanged` on each audit script independently. Expected failure is `QA report auditor worktree differs from pinned source`.
- Keep all 7 previous source/test and symlink cases, plus 2 new audit integrity cases (9 synthetic cases total). Retain the existing B1-116 output marker and append `BOSTAN_B124_AUDITOR_INTEGRITY` when the extra checks pass.
- The fixture correction was committed at `a5f2a1e724570edbe709dc3b6e35a7e9b5d198e8`, newline/diagnostic correction at `f30f32867397e75cc65d8eaf62706b6756ff00e4`. Final fetched Git blob: `86e0f001e74df6afcb05d186bcaa2177508bfaf2`.

**Important execution boundary:** the two new regression cases were inspected in the GitHub file, but the complete 9-case admission script was **not executed against an actual private checkout** in this wave. The **9/9 PASS** reported above applies only to the byte-identical Node JSON audit test script. Do not conflate these distinct results.

## Next necessary gates

On a **separately owned disposable native Linux checkout of this private exact PR SHA**, with existing Node>=24.11, Vitest5, TypeScript7, unprivileged bwrap and >=2 GiB free RAM/disk, first run `bash scripts/bostan-private-linux-sandbox-gate.test.sh` (existing source integrity fixture), then run `bash scripts/bostan-private-linux-sandbox-gate.sh --run`. Record source SHA, the four verified bubblewrap case markers, actual exit statuses and package typecheck; do not override failed namespace permissions or skip any case. Then perform installed Windows/macOS/Linux qualification, controlled agent effects/consent, repeated real PostgreSQL stress #234, privacy/tenant isolation, and third-party license/NOTICE/provenance checks.

Desktop Commander previously returned an explicit **monthly quota exhausted / do not retry** result, so no remote device call was attempted. Repository remains **PRIVATE**, all PRs **DRAFT and UNMERGED**, main unchanged, no Actions enabled, paid infrastructure, publication, deployment or release.

**Overall Bostan release: NO-GO.**
