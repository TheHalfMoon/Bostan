# B1-35 — Share native Windows private QA entry gate across source and compiled server

Date: 2026-10-29. **PRIVATE**, strictly nonpublishing `TheHalfMoon/Bostan`. Exact stacked parent B1-34 Draft PR #287 at `68223f424703557bec3048ae16b5e55b12bedcf9`.

## Security and qualification gap

B1-34 introduced explicit `--run-compiled` to exercise the SHA-256-owned, plain Node `server/dist-runtime/index.mjs` through the real native Windows authenticated HTTP/embedded PG harness. However the existing source path used `scripts/bostan-private-windows-server-entry.mjs` to validate the synthetic fixture INSIDE the child before importing the application; the compiled path directly executed the compiled server and therefore skipped the child's entry guard. Wrapper-side disk, RAM, name, TEMP and owner checks alone are not a substitute for a child-side no-cloud/no-user-data admission.

## Code

- New `scripts/bostan-private-windows-entry-admission.mjs` carries the source-entry's exact native-Windows and synthetic-only conditions: checkout B###-qa, exact owner marker name and contents, no symlink, loopback PostgreSQL port, authenticated/private deployment, and no managed/cloud variables.
- Source `scripts/bostan-private-windows-server-entry.mjs` reuses that shared validator. It still rejects a forbidden fixture before importing the application and keeps existing stage/failure diagnostics.
- New `scripts/bostan-private-windows-compiled-entry-guard.mjs` runs as a Node `--import` preload **before** the compiled executable. On refusal it exits 2 and prints a constant, secret-free error; it never executes the application.
- `scripts/bostan-private-windows-server-command.mjs` retains unchanged source args and uses `--import file:///.../scripts/bostan-private-windows-compiled-entry-guard.mjs <owned-dist-runtime-index.mjs>` for compiled mode. The existing SHA256 ownership admission remains mandatory before scratch PG starts.
- New `scripts/bostan-private-windows-entry-admission.test.mjs` and updated selector tests cover valid synthetic Windows conditions, cloud/remote DB/refused markers and linked outputs, Windows preload and synthetic plain-Node execution.

## Actual native Windows qualification

Authorized Desktop Commander device **Abdulaziz** came ONLINE. Native Windows 11 with **Node.js 24.19.0**; pinned current repo branch `work/b1-35-shared-windows-qa-entry-gate` checked out at exact commit `c588691430a83fa0c53678e3f970daecfe44dc26` after two portable-test fixes. Test-only D:\Bostan-B135-qa is a **new clean detached Git worktree** from the private GitHub branch; the preexisting D:\Bostan-B111-qa was not changed.

**Initial real Windows tests:** 11 PASS, 2 FAIL, 1 SKIP from two test portability issues (symlink EPERM and Linux-style URL path). After correcting those, 12 PASS, 1 FAIL, 1 SKIP; the remaining test erroneously supplied a *valid* Windows fixture while asserting rejection. Fixed by explicitly supplying an invalid fixture.

**Final Windows regression test run (after further fixes):** exact `git HEAD=c588691430a83fa0c53678e3f970daecfe44dc26`, Node `--test` over:
- `scripts/bostan-private-windows-entry-admission.test.mjs`
- `scripts/bostan-private-windows-server-command.test.mjs`
- `server/scripts/bundle-runtime-commit.test.mjs`
- `server/scripts/bundle-runtime-staged-rollback.test.mjs`
- `server/scripts/bundle-runtime-recovery.test.mjs`
- `server/scripts/bundle-runtime-lock.test.mjs`
- `server/scripts/bundle-runtime-build-lock-integration.test.mjs`
- `server/scripts/bundle-runtime-lock-cross-process.test.mjs`

Result: **49 tests, 46 PASS, 0 FAIL, 3 SKIP**, `TEST_EXIT=0`, total test duration 24.7s (remote wrapper runtime 47.2s). Skipped tests require symlink privileges unavailable on this standard Windows account. The **native Windows junction backup rejection test PASS**, along with independent Node process lock exclusion and real stage/rollback filesystem tests. Earlier cross-platform fixture failures were corrected in the same Draft branch:
- `bundle-runtime-build-lock-integration.test.mjs`: use `basename(file)` not `split('/')` for owner manifest names.
- `bundle-runtime-recovery.test.mjs`: use real Windows directory junction for link test; explicitly skip file symlink cases only when OS refuses privilege, never silently pretend they passed.
- `bostan-private-windows-entry-admission.test.mjs`: use an existing `new URL(..., import.meta.url).href` rather than reconstructing a Windows ESM URL from `.pathname`; reject an explicitly bad fixture; skip only unsupported symlink creation.

**Resource-guard stop before dependency install:** Before attempted scoped offline `pnpm` install, native Windows memory fell to **2.22 GiB free**, below the documented **2.8 GiB** admission threshold; the guard printed `INSTALL_REFUSED_RESOURCE_GUARD` and did not start install. A later read returned 1.95 GiB, D: 13.58 GiB and C: 7.34 GiB. There were **0 postgres.exe** processes. No unowned processes were terminated; no user files/apps modified.

Mac device also returned ONLINE, reported ~24 GiB available, 46% memory free; no existing Bostan checkout found in the shallow home search. Its full app build has **not** been qualified in these Windows results.

## Important NO-GO

These are real **native Windows unit/OS filesystem/process tests**, **not** a true compiled Bostan production server/PG startup. The real pinned `esbuild 0.28.2` full bundle, authenticated Windows localhost 18-stage HTTP/Better Auth/first-admin (#237), multi-suite PostgreSQL io_worker orphan proof (#234), Chromium, genuine zero-cost agent, Mac and installers remain open. No unsupported claim that an authentic app server was ready.

Private repo, no Actions activation, main merge, publishing, deploy, release, npm pack, paid model/compute, customer data, human-review dependency or deletion of unrelated processes/files. Release remains **NO-GO**.
