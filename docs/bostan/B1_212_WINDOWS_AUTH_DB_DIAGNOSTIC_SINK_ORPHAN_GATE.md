# B1-212 — Preserve native Windows auth/DB final orphan scan after diagnostic sink failure

Status: PRIVATE OPEN DRAFT ONLY, RELEASE NO-GO. Stacked on #468 exact HEAD `8fa2e2071e2d9df5a00b46db669d59364930aa4f`. No main merge, Actions, publication, paid providers, customer records, process termination or cleanup.

## Source-backed defect

The B1-210 seven-step auth/DB orchestrator calls supplied log/error callbacks directly. A throwing log callback on a successful plugin-SDK receipt or before a workload, or a throwing error callback after a failed PostgreSQL test, could escape before the final read-only PostgreSQL orphan scan. This defeats the earlier failure-path scan guarantee even when the child itself returns normally. The reproduced cases use synthetic throwing sinks; no claim of an observed Windows broken pipe.

## Repair

Catch exceptions from both diagnostic callbacks without copying raw errors to output. Record `diagnosticFailed`, refuse any further workload after a diagnostic failure, but still attempt the final read-only orphan scan if the initial scan succeeded. A failed initial orphan scan continues to refuse all workloads without a final scan. A broken final receipt also forces overall failure. The original seven-step order, pinned binaries, timeout values and PostgreSQL process handling are unchanged; no kill or deletion is introduced.

## Test-first evidence

Isolated Linux Node v22.16.0, exact parent source blob `26585c5007f45326c9099582669bacf51caaf7aa`: five new tests yielded **1 PASS / 4 expected RED**. After the source repair, the expanded eight-test diagnostic suite **8/8 PASS**, and the unmodified existing test suite, blob `4eebb51e0122cb1dc011e390673885223cb84669`, **10/10 PASS**; combined **18/18 PASS, zero skips, exit 0**. Both new JavaScript files passed `node --check`. Repaired source Git blob `767b3d09bdd2d717d7b58f1571810879bdf54b09`; new test blob `7483842874d1672d13b8274bde1c3d1c7e3e850d`. Tests cover closed stdout/stderr at initial gate, workload start, intermediate receipt, failed DB workload, final receipt and final scan, plus healthy behavior. Local isolated scratch is to be inventoried and removed after verification.

## Limits and release blockers

This covers synchronously throwing callbacks only, not process termination, asynchronous stream errors or atomic process attestation. No native Windows/PG18.1 forced-crash io_worker zero-orphan (#234), installed compiled authenticated HTTP/Better Auth/Chromium (#237), root/server TS7/Vitest, macOS/Linux PG/bwrap or installed three-OS E2E was executed. Remote Desktop Commander monthly quota was not retried or bypassed. Retained `D:/Bostan-B212-qa` assets and all foreign/user files and processes remain untouched. Donor LICENSE/NOTICE/provenance unchanged. **RELEASE NO-GO.**
