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

## Qualification limits / release blockers

This is a **security/data-loss guard against nonempty scratch deletion** in the test fixture, proved using a synthetic constructor failure. It is NOT a real PostgreSQL `io_worker` forced-crash, multi-worker stress, compiled server, Chromium integration, or installed-app qualification. Issue #234 remains OPEN for repeated crash/worker orphan evidence; #237 remains OPEN for compiled Windows runtime and real Chromium signup/role/tenant journeys. Full TypeScript7/root Vitest, Linux unprivileged bwrap, all installed OS journeys, side-effect consent, tenant privacy and legal provenance remain outstanding.

Keep the repo PRIVATE, PR DRAFT/UNMERGED, releases NO-GO; no main merge, GitHub Actions, publication/deployment, paid services, customer data or foreign cleanup.
