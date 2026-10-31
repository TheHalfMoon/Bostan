# B1-87 — Fail closed on foreign PostgreSQL data-directory paths in postmaster.pid

Date: 2026-10-31. **STRICT PRIVATE · ZERO COST · NONPUBLISHING · STACKED DRAFT ONLY.** Exact parent B1-86 Draft PR #341, `7c0d0ea17db0eb4cd8660a890b62f0b497d61623`. No production server, release, deployment, or GitHub Actions changes.

## Reproduced issue and bounded correction

The native Windows test-only PostgreSQL shutdown helper previously verified only the decimal first line of `postmaster.pid`, the marker's file identity, and `PG_VERSION`. PostgreSQL's PID marker also contains its **data-directory path on line 2**. A marker with a valid-looking PID but a different directory was accepted, allowing a `pg_ctl stop` request to be made before the later marker-survival check. A fake runner test on the unchanged B1-86 parent demonstrated this: **46 PASS, 1 FAIL, 1 SKIP**, with `shutdowns=1` when the expected count was zero. No real process was stopped.

B1-87 reads only the existing bounded (at most 4096-byte) opened marker and requires a second newline-terminated path line. It decodes only that path as strict UTF-8, rejects control characters, relative paths, and on Windows drive-less rooted aliases. The path must resolve to the exact previously admitted owned scratch cluster (`realpathSync`, case-insensitive comparison on Windows) **before any `pg_ctl` call**. The original PID decimal check, opened-file/path identity checks, `PG_VERSION` identity checks, two independent CIM process scans, and fail-closed cleanup behavior remain intact. No arbitrary marker contents, paths, PIDs, credentials, or process command lines are logged.

The synthetic positive fixtures now use a realistic two-line PID/data-directory marker. New regressions reject a foreign data-directory path, missing second line, relative path, and invalid UTF-8 bytes before either shutdown or process inspection.

## Executed evidence

- Authorized native Mac / Node 26 / Vitest 5 / one worker / 1024 MiB heap: **48 PASS, 0 FAIL, 1 SKIP** (49 tests) after the correction.
- Targeted strict TypeScript `pnpm --filter @bostan/db exec tsc --noEmit -p tsconfig.json`: **EXIT 0**.
- `git diff --check`: **PASS**.
- No real PostgreSQL stop or Windows process inspection in this wave. Mac has an unrelated preexisting Homebrew PostgreSQL service, untouched.
- The currently connected Windows Desktop Commander device ID differs from the explicitly authorized native Windows device ID; **no Windows command was executed**. Native Windows compatibility, including actual PostgreSQL PID-marker encoding/path spelling, remains unverified for this new guard.

## Scope and release NO-GO

This preflight prevents the reproduced **foreign data-directory marker** from reaching the shutdown runner; it is **not** an atomic guarantee that a PID belongs to the owned PostgreSQL process, nor a proof of concurrent multi-suite cleanup. A malicious marker containing the correct data path and a foreign PID still needs OS-level process identity proof. Do not infer that stale PID files can be removed safely.

Historical B1-53 proved a narrower genuine native Windows Chromium + Better Auth + PostgreSQL Members journey, while B1-60's stronger same-DB 12-concurrent-write Windows journey was RED at intermittent packed static import before HTTP readiness. The new B1-87 test does not rerun either. #234 parallel multi-suite no-orphan, #237 stable Windows packed startup, offline genuine local agent, Linux full runtime, installers, privacy/security, full semantic qualification, copy-first licenses/NOTICE/provenance remain gates. **Release NO-GO.**

Repository must remain PRIVATE; `main` was unchanged and `protected:false` at preflight, Actions disabled. No main merge, publish, release, deploy, npm pack, paid model/cloud, customer data, foreign process kill, old retained-fixture deletion, or local disk cleanup.
