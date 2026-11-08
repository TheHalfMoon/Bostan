# B1-208 — Bind native Windows disk headroom to the verified OS-root drive

Date: 2026-11-02 Asia/Riyadh. **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO.**

## Source-backed bug

`scripts/bostan-private-windows-disk-admission.mjs` was meant to refuse heavy Windows QA if the system drive has less than 2 GiB free, or if the checkout/temporary volumes have less than 6 GiB free. The existing system-volume selector instead used **only** the ambient `SystemDrive` environment variable:

```js
const system=driveRoot(systemDrive+"\\");
```

In an isolated Node 22.16.0 regression using the **exact GitHub parent source blob** `ffb84759b65a267bae5272d11a9bdcf3ab9698e0`, passing `SystemRoot=C:\\Windows` and a conflicting `SystemDrive=D:` caused the checker to inspect only **D:** and return **allowed:true**, even when the intended Windows drive **C:** was declared empty. A `SystemDrive` value containing a longer path could also masquerade as a drive label. The private native HTTP and auth/DB runners both invoke this helper before expensive work. The newer HTTP runner separately validates OS executables from SystemRoot, but the disk checker did not bind the free-space check to that same root identity.

## Change

The read-only disk gate now accepts `systemRoot=process.env.SystemRoot` explicitly, requires a conventional direct `<drive>:\\Windows` root matching the native executable admission policy, accepts `systemDrive` **only** as a two-character drive designator, and requires the case-insensitive OS-root drive and SystemDrive to agree **before any statfs calls**. Invalid, mismatched or missing values refuse with the existing secret-safe `invalid_volume` status and no disk probes. Valid alternate native system drives and case variations remain supported; existing 2 GiB and 6 GiB thresholds, cross-volume aggregation, redacted errors and read-only behavior are unchanged.

This is not an OS filesystem identity attestation: the native HTTP executable admission continues to separately lstat-check the real system root and cmd.exe. A production Windows release must still verify the actual host.

## Test-first evidence

- Exact old source blob: `ffb84759b65a267bae5272d11a9bdcf3ab9698e0`, independently reconstructed and verified with `git hash-object`.
- Isolated Node 22.16.0 executable regression against the **old source**: **2 PASS / 3 FAIL**. The three failures verified that mismatched `SystemDrive`, non-drive designators and unverified `SystemRoot` were accepted. On the specific conflicting-root reproduction the old checker reported `allowed:true` and queried only `D:\\`.
- The exact **fixed source blob** `8eba3c4b9d75c702ed347f14cb43596d28610229` passed the same test **5/5**, zero skips, exit0, and `node --check` passed.
- Five additional legacy-behavior probes using exact fixed source and synthetic filesystem stats passed: low C: space refused; exact 2 GiB system/6 GiB workspace thresholds preserved; shared-volume maximum preserved; separate temporary drive checked; filesystem errors remain fail-closed and redacted. **Total 10/10 PASS**, zero skips, exit0.
- Private GitHub's new committed targeted regression `scripts/bostan-private-windows-disk-system-root.test.mjs`, Git blob `c51bdb852ec3263d6b586b1586a8313d728585d3`, independently matches the local actually-run five-case Node test file.
- The pre-existing disk test file `scripts/bostan-private-windows-disk-admission.test.mjs`, now blob `67aa5da9f8bfb519f8f8a0f9137833ae4f651dc8`, was updated to supply a synthetic canonical `systemRoot` in its shared fixture and add four more disk/OS-root cases. **The complete existing repository test file was not executed in this isolated test harness**, only the five exact committed targeted regression cases and five equivalent legacy behavior cases were executed.

## Limits / hold

No remote Windows access was attempted in this wave. The Desktop Commander provider had explicitly reported monthly usage exhausted; an online/paired indicator does not authorize quota bypass. The previously owner-only `D:\\Bostan-B212-qa` staged native PostgreSQL binary copy still has unverified final inventory/hash/completion; retain it for inspection only when legitimate access is restored. No real database, forced crash, compiled HTTP, authenticated browser or app was started.

**Critical RELEASE NO-GO:** issue #234 genuine native Windows repeated forced-crash PostgreSQL `io_worker` zero orphan proof, issue #237 fresh fully installed exact-SHA compiled Windows localhost HTTP with synthetic Better Auth signup/session/first admin/tenant/roles and Chromium, native Linux/macOS real PG template qualification, full root TS7/Vitest, Linux bwrap, installed three-OS packaging, privacy/consent/security/donor LICENSE and NOTICE. No main merge, Actions, publication, deployment, paid services, foreign process termination or foreign file deletion.
