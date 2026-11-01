# B1-165 — Fail closed on nonempty PostgreSQL pre-start scratch

**2026-11-01 Asia/Riyadh | PRIVATE / ZERO COST / DRAFT / UNMERGED / RELEASE NO-GO**

Direct parent: private B1-164 PR #421 at exact SHA `f1744e1e7d24e2ae5235278a95832efd230d4a86`. Proposed code/test source SHA **`2d188eca7e70337ccc1a174d2079dca6a20fb9f9`**. No production app/real database code changed; only DB testing fixture and regression.

## Vulnerability found in preceding scratch fix

PR #421 correctly protected pre-start PostgreSQL scratch with directory identity checks but still called `fs.rmSync(dataDir, { recursive: true, force: true })` after a failed embedded PostgreSQL constructor. Same directory identity is NOT proof of exclusive contents: a directory may become populated with files from another actor or concurrently generated unexpected data before cleanup. This could recursively erase contents that the fixture never created or has not verified as owned.

## Narrow production-facing test fixture repair

In `packages/db/src/test-embedded-postgres.ts`, after the existing lstat dev/ino/birthtime and non-symlink checks, replace recursive `fs.rmSync` with atomic **nonrecursive** `fs.rmdirSync(dataDir)`. This only succeeds for an *empty* directory. Any `ENOTEMPTY`, replaced path, I/O or other refusal is caught and rethrown as a generic `Fresh PostgreSQL scratch not empty or unavailable; retaining fixture` with the original constructor error as its cause. A clean empty scratch still gets reclaimed and the original constructor exception is propagated unchanged. No process is signaled, and existing post-start PostgreSQL teardown is unaffected.

New regression `packages/db/src/test-embedded-postgres-prestart-cleanup.test.ts` retains the original empty-directory test and adds one scenario where the injected synthetic constructor provider creates a test-owned sentinel inside the already-created scratch just before rejecting. It asserts that the unexpected file survives and the fixture refuses recursive deletion. Afterward the test verifies and individually unlinks only its own known sentinel, removes the now-empty child with `rmdirSync`, and removes its own unique scratch marker/root without deleting unknown entries.

## Real native Windows test receipt

Executed actual source from the exact proposed SHA `2d188eca7e70337ccc1a174d2079dca6a20fb9f9` on an authorized Windows 11 workstation, **Node v24.19.0 / Vitest v5.0.3**, in an existing clean sparse B177 QA checkout with pre-installed pinned DB test dependencies. The test does **not** launch real PostgreSQL; it injects deterministic constructor failures with the documented test seam.

~~~powershell
# From packages/db, after verifying HEAD and free RAM >= 3.3 GiB
$env:NODE_OPTIONS = '--max-old-space-size=1152'
.\node_modules\.bin\vitest.cmd run src/test-embedded-postgres-prestart-cleanup.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1
~~~

**Actual result: 1 test file PASS, 2/2 tests PASS, 0 fail, exit 0; Vitest duration 4.22s, entire terminal session 6.11s.** Test RAM admission before run was ~3.96 GiB free. Neither test contacted cloud, read customer data, started PostgreSQL, executed a paid provider, or modified an outside repo.

After-run independent read-only checks: Git checkout **CLEAN**, `postgres.exe` **0**, **0 remaining** unique `bostan-pg-(prestart|nonempty)-owned-*` test scratch roots in the process temporary directory. The pre-existing B177 test checkout was returned to **exact original detached SHA `e02229502d664a3594174886752e794a3a43edaf`**, original sparse scope `packages/db`, and verified CLEAN and zero PostgreSQL processes. No unrelated files, processes or global Cargo cache changed.

## Follow-up: test fixture's own teardown now also nonrecursive

After the successful native Windows source test at `2d188eca7e70337ccc1a174d2079dca6a20fb9f9`, the already-existing first regression test's `finally` path was tightened from `fs.rmSync(...,{recursive:true,force:true})` to `fs.rmdirSync(owned)` for an empty directory. This prevents that test harness itself from erasing unexpected nested data. Only test code changed; the previously qualified production-facing fixture fix and the new nonempty-sentinel test are unchanged. New code commit **`e3a501cea319e3b373b074c71668775e73a825a5`**.

**Evidence timeline, accurately scoped:** the exact-final-commit Windows checkout/test request was refused by remote computer safety controls; we did not bypass it. The previous native Windows 2/2 PASS therefore belongs only to commit `2d188eca...`. Subsequently, **the exact final source SHA `658755eb471a166ed258960900d01879b6cdc806` was genuinely tested on authorized macOS**; results appear below. This resolves the final-source test gap on macOS, **not on Windows**. Windows B177 remained at its original detached SHA and clean, with 0 postgres.exe processes.

## Exact final-source Mac requalification and real PostgreSQL compatibility — PASS

- Already existing clean full private Mac B142 QA checkout with pinned dependencies; original detached SHA `88e0274412c2e6cbadd07534960b20184907f291`. On 2026-11-01, fetched and temporarily checked out **EXACT** private B1-165 final source SHA `658755eb471a166ed258960900d01879b6cdc806`, verified Git CLEAN.
- Native Apple Silicon macOS, Node **v26.0.0**, Vitest **v5.0.3**; preflight memory **43% free** for the prestart suite and **43% / 47% free** before real embedded-PostgreSQL tests, each exceeding the 35% resource floor. All tests invoked separately using `--pool=forks --maxWorkers=1`, no cloud, no customer data.
- **Test fixture prestart cleanup**, exact file `packages/db/src/test-embedded-postgres-prestart-cleanup.test.ts`: **2/2 PASS, 0 failed, EXIT 0** (Vitest duration **913ms**), testing both empty scratch reclamation and refusing to delete new unexpected sentinel contents. This is the FIRST successful full regression run against the FINAL source including nonrecursive test teardown.
- **REAL migrated PostgreSQL + Better Auth**: exact file `server/src/__tests__/better-auth-credential-signup.integration.test.ts`: **1/1 PASS, EXIT 0**, Vitest duration **7.21s** (the integration test actually creates a disposable DB and synthetic signup/session).
- **REAL migrated PostgreSQL + first-admin**: `server/src/__tests__/first-admin-claim.test.ts`: **4/4 PASS, EXIT 0**, Vitest duration **9.30s**. These tests prove the repaired prestart fixture has not broken authentic database setup and cleanup paths on macOS.
- **Total on final source**: 3 test files, **7/7 PASS**, zero failed/skipped and all process exits 0. Exactly **5/7** tests used real temporary PostgreSQL, while **2/7** were synthetic pre-start failure regressions.
- After running the test cases, independent read-only Mac checks found **0 matching disposable scratch root directories** and **0 PostgreSQL processes attributable to the private QA checkout**. The existing Mac B142 checkout was restored to exact original detached SHA `88e0274412c2e6cbadd07534960b20184907f291` and verified Git CLEAN; unrelated Homebrew PostgreSQL service was never terminated.
- This does **not** establish an exact-final-source native Windows test. That remains separately unqualified because of the safety-tool refusal. It also does not prove native Windows forced-crash `io_worker` recovery or release readiness.

## Qualification limits / release blockers

This is a **security/data-loss guard against nonempty scratch deletion** in the test fixture, proved using a synthetic constructor failure. It is NOT a real PostgreSQL `io_worker` forced-crash, multi-worker stress, compiled server, Chromium integration, or installed-app qualification. Issue #234 remains OPEN for repeated crash/worker orphan evidence; #237 remains OPEN for compiled Windows runtime and real Chromium signup/role/tenant journeys. Full TypeScript7/root Vitest, Linux unprivileged bwrap, all installed OS journeys, side-effect consent, tenant privacy and legal provenance remain outstanding.

Keep the repo PRIVATE, PR DRAFT/UNMERGED, releases NO-GO; no main merge, GitHub Actions, publication/deployment, paid services, customer data or foreign cleanup.
