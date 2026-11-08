# B1-206 — Windows private HTTP QA child fixture boundary

**Status:** PRIVATE / OPEN DRAFT / UNMERGED. **RELEASE NO-GO.** Direct stack on #462 at `e866c9f42b12e8919a36838019bea7a93aeda9f9`.

## Source-backed issue

The isolated Windows HTTP QA runner creates a fresh `bostan-private-auth-http-*` HOME and a `BOSTAN_QA_OWNED` marker. The environment builder previously accepted any nonempty HOME, marker path and Better Auth secret. A caller supplying a foreign or traversing HOME/marker would pass these *string* gates and forward the values to the child. The builder also silently preferred `SystemRoot` over a conflicting `WINDIR`, accepted `WINDIR` without `SystemRoot`, and rejected valid case variants already accepted by B1-205's OS preflight.

## Change

Before constructing the child environment, require a canonical drive-rooted Windows HOME with the generated QA leaf, no UNC/device/relative/ADS/traversal/control/trailing-dot components, and a direct `BOSTAN_QA_OWNED` marker within that exact HOME. Reject short, control-bearing or unbounded Better Auth secrets. Require canonical `SystemRoot`, and refuse a present but mismatched `WINDIR`; permit case-insensitive Windows directory spelling. Preserve the existing explicit 127.0.0.1 HTTP, synthetic `/paperclip` PostgreSQL, fixed PATH/ComSpec and inherited-token exclusion checks. No process stop or filesystem deletion changes.

## Isolated evidence (Linux Node 22.16.0)

- Test-first reconstructed pre-repair helper behavior: **1/11 pass, 10 expected failures**, exit 1. This is a local reproduction of the source logic, **not** a claim that the full remote parent test suite ran.
- Repaired isolated helper: **11/11 new tests pass**, plus **15/15 existing environment/DB URL/system-path tests pass** = **26/26**, zero skips, exit 0. `node --check` passes for the repaired helper and new tests.
- New committed test Git blob: `19e69274c6ff2f41ea961fb1a3c799fbdb64276e` (matches locally tested file). Updated source blob: `c4f134b8e394f8af21f26e4f31afea4a162b46d0`. Source was patched directly from the exact parent GitHub blob, retaining existing comments and behavior outside the guarded lines.
- Only isolated synthetic fixture strings and a local Node child were used. No real PostgreSQL, browser, user device, retained QA, paid service, or customer data.

## Limits and release gates

This is **string admission**, not proof of actual scratch ownership, cryptographic secret entropy, kernel identity, or an atomic filesystem race defense. The B1-198 inode/marker cleanup closure and B1-205 OS executable preflight remain independently mandatory. No native Windows lstat/PowerShell/PG/Chromium, root TS7/Vitest, or installed three-OS E2E ran. Issues #234 (real repeated Windows forced-crash io_worker zero-orphans) and #237 (fresh installed compiled authenticated localhost HTTP + actual Chromium) remain open. Remote Desktop Commander monthly quota remains exhausted; no access retry, alternate tool, or B212 retained fixture access. No main merge, GitHub Actions, release, publication, deployment, foreign cleanup, or license removal.
