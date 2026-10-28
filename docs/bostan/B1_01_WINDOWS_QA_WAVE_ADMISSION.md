# B1-01 — Unblock B100 Windows QA checkout and TEMP admission

Date: 2026-10-28. Private Bostan engineering, stacked on B1-00 Draft PR #252. No main merges, release, deployment, GitHub Actions activation, paid inference or user/customer data.

## Reproduced blocker

B1-00's native Windows retake instructions use an isolated disposable checkout named `Bostan-B100-qa` and temporary directory `Bostan-B100-temp`. **Three different source files still gated their own paths with `/^Bostan-B0\\d+-qa$/i` or equivalent, and TEMP with `/^Bostan-B0\\d+-temp$/i`.** Those regexes admit B0xx but categorically **reject B100**. Both the real-HTTP parent and nested server-entry child therefore refuse a B100 checkout **before attempting the health request**, regardless of whether dependencies, PostgreSQL, disk headroom or application startup are good. The auth/DB qualification runner has the same problem.

This is a genuine harness admission blocker, but fixing it alone does not solve the earlier native Windows source-server import/startup stall or owned PostgreSQL `io_worker` leftovers.

## B1-01 repair

- Create pure, dependency-free `scripts/bostan-private-windows-qa-wave.mjs` with `parsePrivateWindowsQaWave(name, role)` and `matchingPrivateWindowsQaWave(checkoutName, tempName)`.
- Require the exact basename `Bostan-BNNN-qa` or `Bostan-BNNN-temp` with precisely **three ASCII digits** (e.g. `B086`, `B099`, `B100`) and no prefixes/suffixes/path traversal. Refuse invalid types or unknown roles. Normalize only ASCII name casing for Windows.
- Require checkout and TEMP **to have the same BNNN wave**, strengthening isolation over the old independent regex checks.
- Wire the shared helper into:
  - `scripts/bostan-private-windows-live-http.mjs`: gate native private HTTP parent and same-wave TEMP.
  - `scripts/bostan-private-windows-server-entry.mjs`: gate the actual spawned Node server entry before importing the real server.
  - `scripts/bostan-private-windows-auth-db.mjs`: gate the scoped server/DB qualification runner and same-wave TEMP.
- Leave **all pre-existing** Windows platform, Node, temporary directory symlink, protected repo, disk free-space, private mode, owned marker and anti-managed-Cloud checks in place. The helper checks the **basename only**; it does not certify ownership, disk capacity, process safety or PostgreSQL teardown.

## Verification

Node **22.16.0** isolated Linux container with two files **byte-for-byte identical to GitHub branch blobs**:

| Source | Git blob SHA |
|---|---|
| `scripts/bostan-private-windows-qa-wave.mjs` | `972c97c3c311e74836c0de86d98bad5fe957d515` |
| `scripts/bostan-private-windows-qa-wave.test.mjs` | `b933b20afa8f7ba1073da4ff218d749ee698025a` |

Actual `node --test`: **5/5 PASS**, zero failed or skipped. Cases exercise B0xx and B1xx acceptance, strict equal wave, refusal of mismatched checkout/TEMP roles, traversal, prefix/suffix, lookalike/overlong names and case handling. `node --check` passes for both files.

GitHub source audit confirmed all three native runners use the shared helper at the branch exact head:

- HTTP parent blob `8c8588421c9cecf45663ebe54cc4c58b3f289908`.
- Server-entry blob `ec993f0506a72fc07dcdade191c7b5f9c2c07b2a`.
- Auth/DB runner blob `a25a2284e92c7dfa53d1a92d893009a5032978ee`.

No full Node24 native **Windows** server execution took place during this wave. These tests demonstrate **admission logic** only; do not interpret them as PostgreSQL, localhost HTTP, auth, Chromium/Playwright, complete application or release success.

## Next qualification gates

- Preserve B1-00's system C: >=2 GiB and workspace/TEMP >=6 GiB safeguards. Last Windows C: observation was approximately 0.323 GiB available; do not attempt heavy native QA or remove personal files without verified safe admission.
- If authorized device access is legitimately available after the prior Desktop Commander monthly quota, create a **fresh owned** `Bostan-B101-qa` checkout with matching `Bostan-B101-temp`, verify the exact head and frozen dependencies, then run both `node --test scripts/bostan-private-windows-qa-wave.test.mjs scripts/bostan-private-windows-qa-env.test.mjs scripts/bostan-private-windows-live-http.test.mjs` and actual native Windows HTTP/DB probes. Verify they pass admission, then isolate the remaining import/runtime blocker with secret-safe timing and migrate real PostgreSQL.
- Independently prove zero owned orphan `postgres.exe --forkchild=io_worker` after PG cleanup using PID/executable-path/parent checks **without touching unrelated processes**. This remains Issue #234.
- Then finish Mac real 16-stage authenticated HTTP, Windows/Mac Playwright, first zero-cost agent task, compiled build, installer, licensing and security. Issue #237 remains open until the real Windows HTTP journey passes.

**Bostan PRIVATE; all branches Draft; no publish or main merge; release NO-GO.**
