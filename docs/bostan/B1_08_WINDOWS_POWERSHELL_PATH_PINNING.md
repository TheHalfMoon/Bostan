# B1-08 — Pin the native Windows PostgreSQL scanner to system PowerShell

Date: 2026-10-28. Bostan PRIVATE. Stacked Draft on B1-07 PR #259 at head \`db05debda80dfdbfd8a01d25a817d6c28b9c249b\`. No main merge, Actions activation, deployment, release, publication, paid cloud/model use, or customer data.

## Concrete source-level defect

The B1-07 native Windows authenticated HTTP QA runner launched the read-only PostgreSQL process scanner with \`spawnSync("powershell.exe", ...)\` while forwarding the operator's \`PATH\` to that child. This resolves an executable by name and can select a different \`powershell.exe\` from an untrusted earlier PATH entry. The scanner is part of the security-sensitive post-teardown proof for orphaned \`postgres.exe\` workers; it must not execute an arbitrary PATH-selected binary.

## Implemented fail-closed fix

- New \`scripts/bostan-private-windows-powershell-binary.mjs\` resolves the **absolute** system executable from \`SystemRoot\` under \`System32\WindowsPowerShell\v1.0\powershell.exe\`. It refuses non-Windows hosts, relative/UNC/device or malformed system-root paths, traversal, unexpected root basename, missing/non-file executable and a symlinked executable. It returns only a validated binary path; it never starts a process.
- The native HTTP runner now calls this resolver **after** the owned server has closed and embedded PostgreSQL cleanup has completed. The actual scanner subprocess uses the returned absolute path, not a PATH lookup, and no longer forwards the operator PATH in its reduced environment.
- Resolver or spawn exceptions are caught without exposing paths/tokens; the process proof receives an absent/nonzero result, **fails closed**, does not emit \`BOSTAN_WINDOWS_LIVE_NO_POSTGRES_ORPHANS_PASS\`, and preserves the owned fixture for investigation. Existing 20-second timeout, 8192-byte output bound, strict three-line PowerShell proof, 16 ordered HTTP stages and \`releaseQualified:false\` are unchanged.
- Updated the existing native runner source-level regression to require the pinned executable and added a separate PATH-hijack regression assertion. Neither test executes the Windows runner on Linux.

## Verified evidence — scoped, not native qualification

Exact GitHub blobs were independently compared to the **executed local files**:

| File | Git blob | Evidence |
| --- | --- | --- |
| \`scripts/bostan-private-windows-powershell-binary.mjs\` | \`52342edce9639b063596002aee45706534b579aa\` | Isolated Linux Node v22.16.0 \`node --check\` PASS |
| \`scripts/bostan-private-windows-powershell-binary.test.mjs\` | \`d1556cae3b95997c591b83e2f26c00b74ca3b883\` | Isolated Linux Node v22.16.0 \`node --test\` **5/5 PASS**, 0 fail/skip |
| \`scripts/bostan-private-windows-live-http.mjs\` | \`a9812bd5206019ca07566fdd9eb6102ac0da1870\` | Source-level invariant inspection + transformed async-JS syntax parse PASS; native run **NOT performed** |
| \`scripts/bostan-private-windows-live-http.test.mjs\` | \`92606fc6a7310eee7d0b437b4e11866a892202b9\` | Updated static assertions and transformed syntax parse PASS; full runner regression **NOT performed** |

Five actual unit tests cover absolute system binary selection (including Windows on a non-C drive), refusal of relative/UNC/traversal/missing/linked executable, non-Windows refusal, sanitized errors, and a **real zero-exit Node subprocess** that does not bypass the native executable gate. An initial local test failed due to its own undefined-default test helper; the test was corrected and the final exact GitHub-matching suite passed 5/5. No Windows PowerShell process was executed by these tests.

## Native retake and remaining NO-GO gates

- Last observed Windows C: free ~0.323 GiB, below B0-91 >=2 GiB system guard; QA workspace and TEMP each require >=6 GiB and memory admission requires >=6 GiB total and >=2 GiB free. **Do not run heavy native QA while resource gates fail.**
- Authorized Mac/Windows desktop connector was quota-exhausted on Oct 28; no quota bypass/reconnect. On legitimate restored access, use a new marker-owned \`Bostan-B108-qa\` and matching \`Bostan-B108-temp\`, Node >=24.11 and frozen dependencies. Re-run actual native Windows PG+auth HTTP and the pinned PowerShell scanner, require **16 exact ordered markers**, 0 owned/unattributed PG workers and owned fixture cleanup; never terminate unrelated processes. The system binary path is not yet verified on the user's actual Windows installation.
- Native Windows full HTTP and PostgreSQL orphan checks (Issues #237 and #234), macOS retake, Chromium Playwright, compiled server build, first real zero-cost agent workflow, installers, independent security/licensing and backup/recovery remain **NO-GO**.

Bostan remains PRIVATE. This PR is a security hardening of a QA harness, **not** a claim that the product is release-qualified.
