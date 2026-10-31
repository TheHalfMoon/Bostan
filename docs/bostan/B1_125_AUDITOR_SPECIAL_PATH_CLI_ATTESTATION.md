# B1-125 — Make rootless QA audit CLI unskippable in paths containing percent/hash

Date: 2026-10-31 Asia/Riyadh. **PRIVATE, DRAFT, UNMERGED, ZERO COST, RELEASE NO-GO.** Parent B1-124 private Draft #380 exact HEAD `5f3f494a4308463743d69fb1326d5771dc8f47ae`.

## Confirmed silent exit-zero false-green bug

The B1-124 JSON report auditor `scripts/bostan-private-linux-vitest-report-audit.mjs` guarded its executable code using:

`if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href)`

A valid private checkout path may contain literal `%` or `#`. Import URLs encode these characters, but raw concatenation into `new URL("file://" + process.argv[1])` treats percent sequences as escapes and hash as a fragment. On **actual model-side native Linux Node22** in an owner-owned temporary path containing both symbols, the original guard evaluated **false when the script was invoked directly**. It exited **0 with empty stdout**, skipping the entire audit of which bubblewrap tests actually ran. The parent Linux gate trusted exit 0 alone, so it could proceed to `BOSTAN_B112_LINUX_GATE_PASS` without even examining the Vitest JSON. This is a real qualification-path bug, not evidence of a Bostan runtime isolation exploit.

Actual isolated Node evidence:

- Old CLI guard under special-character path: exit 0, **no audit output** (RED; reproduced).
- Guard comparing `path.resolve(fileURLToPath(import.meta.url))` to `path.resolve(process.argv[1])`: recognized the same direct invocation (GREEN).
- Equivalent corrected CLI allowed a valid synthetic report to emit the two expected success markers; invalid synthetic report returned nonzero.
- Bash exact-output attestation correctly rejected the old silent exit-zero case.
- **Four bounded local probe assertions PASS**. Probes used only temporary test-owned files and were removed.

## Fix in actual private GitHub

**Test first**, commit `c862da08c07dbffe29ccb53533b76548263e0eaf`: extend existing `node --test` audit regression from 9 to **11 authored cases**. Two new cases run a *copy of the actual auditor script* as an independent Node CLI under a generated owned `/tmp/bostan-b125-audit-%#-...` path, once with a valid four-suite/four-rootless-test report (must print both success lines) and once with a rootless test marked `pending` (must exit 1 with `BOSTAN_B124_REPORT_REFUSED`). Both own and delete their scratch directories. Original nine JSON schema/missing/failed/duplicate checks remain untouched.

**Audit implementation**, commit `7274ac202d7258f3067daebf498883e6bde51c1a`: import `fileURLToPath` from `node:url` and `path` from `node:path`; compare canonicalized filesystem strings instead of assembling raw `file://` URL with unescaped path characters. This retains behavior for ordinary user checkouts and module import.

**Gate hardening**, commit `9057fec2545543ad9459f35a1bf6a4281fc9f958` (two corrections): after `node audit.mjs report.json` succeeds, capture its stdout and require **exactly**:

```text
BOSTAN_B124_VERIFIED_SUITES=4
BOSTAN_B124_VERIFIED_ROOTLESS_CASES=4
```

If either marker is missing or any unexpected output appears, refuse `rootless bubblewrap JSON audit did not provide exact success evidence`. This independent check means even a future accidentally silent no-op auditor cannot yield a green gate simply by returning exit 0. Corrected Bash `printf` escape sequences were re-fetched from GitHub and confirmed to use real newline formats.

**Git blob pins verified from private repository:**
- `scripts/bostan-private-linux-vitest-report-audit.mjs`: `b361b8563e1ab288c9f81710993a432e87866274`
- `scripts/bostan-private-linux-vitest-report-audit.test.mjs`: `66396962359d57d0c16df2bac04d87ee2080a58e`
- `scripts/bostan-private-linux-sandbox-gate.sh`: `8f44006442a61033afb0e82ef1b474b7a666ae39`

The gate pins both auditor source and regression test blobs; existing Bostan production sandbox source blob `8274f932aac8699b112d6e53d9189596e2a28059` and full Vitest file blob `d0d4b391fad3f5f10379c71e091f367b25299eb1` remain unchanged and pinned. No product source code, permission boundary, dependencies or customer data altered.

## Test honesty and unqualified release gates

**Actually executed:** native model-side Node22 *minimal reproduction of the original CLI condition and fixed filesystem-URL comparison*, plus bounded success/invalid-report/output-attestation probes. **4/4 independent probe assertions PASS**, including an actual old silent-exit reproduction. This was **not** a source-native run of the entire private GitHub audit regression file. The eleven checked-in audit tests were **authored but not all executed in this turn**; the previous nine had passed in B1-124 but the new two require a fresh run in the connected native QA checkout. Do not label 11/11 green without that result.

**Still not executed:** private Bostan source-native Vitest5 four-suite run, TypeScript7 adapter-utils, unprivileged actual `bubblewrap` filesystem/network tests, synthetic 9-case admission script on checkout, installed Windows/macOS/Linux builds, governed agent effects/consent, PostgreSQL sustained stress (#234), privacy/tenant isolation and third-party licensing/NOTICE/provenance. Model container has Node22, no private checked-out source or bwrap; Remote Desktop Commander previously exhausted its monthly quota with explicit DO NOT RETRY; no remote calls were attempted.

**Next:** use authorized owner-marked private disposable native Linux QA checkout at this exact PR SHA with already-installed Node >=24.11, Vitest5, TS7 and rootless bubblewrap. First `node --test scripts/bostan-private-linux-vitest-report-audit.test.mjs` (all **11 expected PASS**), then `bash scripts/bostan-private-linux-sandbox-gate.test.sh` (all **9 synthetic admission checks expected PASS**), then `bash scripts/bostan-private-linux-sandbox-gate.sh --run` (real four suites and all four actual rootless cases, JSON attestation and source-native TypeScript). Preserve exact logs and failures. No namespace privilege bypass, publishing/deployment/release, paid cloud, GitHub Actions or main merge.

**Overall Bostan release: NO-GO.**
