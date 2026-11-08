# B6-08 — Cross-platform saved OpenRouter authentication link rejection QA

Private Bostan source development. Draft-only, unmerged, no deployment, release, paid inference or Actions.

## Actual Windows failure fixed

While expanding real native Windows source qualification after B6-07, four offline source worker/preflight suites yielded 40 PASS and 1 FAIL. The failing test tried to create a Unix /dev/null symlink using fs.symlinkSync in a Windows TEMP profile. Native Windows refused the symlink with EPERM because elevated privilege/Developer Mode was not enabled. That is a *test fixture portability failure*, not permission to relax the production authentication path.

The existing production saved OpenCode auth reader already refuses linked files using fs.lstatSync and nlink !== 1, and only reads owned, plain, single-link opt-in credential files. It does not expose or persist the key outside the private source test.

## Targeted test-only repair

- On macOS/Linux, retain actual filesystem symlink rejection testing against /dev/null.
- On every OS, also create an actual same-volume hard link inside the disposable QA profile, prove its observed link count is > 1, and verify the production saved-auth reader fails closed.
- On Windows, the test runs the NTFS hardlink attack without needing administrative symlink privileges; no test is marked skipped and no account permissions are changed.
- No changes were made to production auth guard, provider pricing/allowlist, external secrets, runner code, API surface, or databases.

## Measured evidence — 2026-10-25

- Mac: **41/41 PASS** for source-only free agent, actual run attribution, evidence-review citation, OpenRouter preflight and bounded native-admission tests.
- Mac: general Bostan source Node regression **115 PASS / 9 Windows-only SKIP**, 124 total.
- Local Alibaba OCR delegation preview: **1/1 changed source file selected**, static rules only, no LLM/paid reviewer.
- Actual Windows 11 source checkout (private, shallow and sparse) at commit c9a2ade: **59/59 PASS / 0 FAIL / 0 SKIP** across native Windows ACL, local runtime, source worker, reviewer, zero-cost preflight and OpenCode admission tests, under native Windows Node v24. NTFS DACL scenarios were executed on synthetic, disposable user-owned directories. The originally failing saved-auth link test passed as part of these 59.

These are real local tests; no OpenRouter model inference, task-completion or independent reviewer reasoning was performed during B6-08. A complete native Windows install with PostgreSQL/browser journeys and real model-driven case completion is still unqualified.

## Open release gates

B4 complete document/OCR/analytics breadth, B5 actual two-agent free-model current-source verifier acceptance, signed canonical Case completion, installed Mac/Windows browser E2E, B6 packaging and comprehensive independent security remain OPEN. Repo Private, GitHub Actions disabled, no merge/deploy/publication. Release NO-GO.
