# B1-213 — Native Windows auth/DB managed environment diagnostic refusal

**PRIVATE DRAFT · RELEASE NO-GO · 2026-11-02 Asia/Riyadh**

## Source-backed risk

At parent PR #469 (commit `8439d9ab42b146c3422fb5ec54ed5ae45b9da991`), `scripts/bostan-private-windows-auth-db.mjs` rejected managed Cloud environment variable names but printed the raw names using `forbidden.sort().join(",")`. An operator-supplied key containing a newline and a forged `BOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS` receipt was therefore reflected into the diagnostic stream. The old expression was reproduced in isolated Node 22 and failed the expected nonreflection assertion. No actual credential disclosure or Windows process execution is claimed.

## Repair

The new read-only `inspectPrivateWindowsAuthDbManagedEnvironment` inspects **key names only** and returns a fixed, bounded refusal marker. It preserves the exact case-insensitive managed-config, primary-host and two Cloud-prefix rejection rules. It never projects a key or value, fails closed on invalid/inaccessible environments, and is invoked in the native runner before executable admission, disk checks or subprocess creation. No environment value is read by this helper. No process termination, deletion, dependency installation or external service is involved.

## Executed evidence

- Linux Node 22.16.0: test-first new module initially RED with `ERR_MODULE_NOT_FOUND` before helper implementation.
- Independent exact legacy expression probe: **expected RED** for an injected newline/forged pass receipt in a Cloud key name.
- After repair: **8/8 node:test PASS**, zero skips, exit 0; `node --check` helper and test PASS.
- Tested helper Git blob: `806711ff63548f5706ea1f7455a81fa009855545`.
- Tested regression Git blob: `7cabda7296c181b06b4056c02bcea6495d961fff`.
- Runner Git blob: `a8d2c65119c2c00a3c0686f79864761feedc0d28`; GitHub source inspected to confirm old raw-name echo absent and fixed-marker gate present.

## Limits and release gates

No native Windows PowerShell, PostgreSQL 18.1 forced-crash io_worker (#234), installed compiled authenticated localhost HTTP / Better Auth / Chromium (#237), full root/server TS7/Vitest, macOS/Linux PG/bwrap or installed three-OS E2E was executed. This closes one diagnostic injection surface, not all asynchronous stdout/stderr stream failures. Retained `D:/Bostan-B212-qa` remains untouched; exhausted Remote Desktop Commander monthly quota was not retried or bypassed. Donor LICENSE/NOTICE/provenance unchanged. **RELEASE NO-GO.**
