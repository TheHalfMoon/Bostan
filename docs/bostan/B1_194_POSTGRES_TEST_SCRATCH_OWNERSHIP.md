# B1-194 — Capture identity of PostgreSQL test scratch before any recursive cleanup

Date: 2026-11-02 Asia/Riyadh. **Private Draft / unreleased / unmerged / RELEASE NO-GO**.

## Concrete data-loss risk

The test-only helper `packages/db/src/test-embedded-postgres.ts` previously contained `cleanupEmbeddedPostgresTestDirs(dataDir)` that executed `fs.rmSync(dataDir, {recursive:true,force:true})` using **only a pathname**. Multiple async operations can occur between creation and eventual cleanup. If that directory is moved away and a different ordinary directory is created at the same path, a later stop/cleanup may delete unrelated `KEEP.txt` files.

A real exclusively owned synthetic Linux Node22 reproduction of the old cleanup snippet (with a replaced `data` directory) confirmed that the replacement `KEEP.txt` was actually removed by the old behavior. It did not touch any user repository or real PostgreSQL.

## Implementation

New pure Node test-only guard `packages/db/src/embedded-postgres-scratch-ownership.mjs` captures the newly allocated scratch directory's lstat identity (`dev`, `ino`, `birthtimeMs`) and canonical path immediately after `mkdtempSync`, requiring an ordinary directory **strictly beneath the real OS temp root**. The returned one-time cleanup closure revalidates all of these fields before doing any recursive `rmSync` and refuses absent, replaced, linked, outside-temp or already-reclaimed directories; refusal retains the fixture and emits only a bounded reason, never a path.

In `packages/db/src/test-embedded-postgres.ts`, a process-local map registers a captured cleanup closure for **both fresh clusters and copied-template root directories**. Every ordinary test-scratch cleanup requires a registered closure, and its tracking entry is removed only **after successful reclamation**. The early initially-empty `rmdirSync` path clears its tracking entry only on success; when a freshly built cluster is renamed into the published template cache, the former disposal authority is explicitly dropped. Import typing is supplied in `embedded-postgres-scratch-ownership.d.mts`.

This does **not** make `lstat` + `rmSync` an atomic filesystem transaction: a concurrently privileged actor can race directory substitution between verification and deletion. It also does not prove that every nested PostgreSQL file is safe to reclaim under hostile concurrent mutation. The change materially prevents deletion of a replacement already present **at verification time**, without claiming a full race-free solution. No process termination was added or changed.

## Exact evidence

- Native isolated Linux Node22 test runner on exact helper and eight synthetic filesystem regressions: **8/8 PASS, 0 skips, exit 0**. Covered normal one-time cleanup; a same-path replacement ordinary directory and its foreign KEEP file retained; replacement symlink and its target retained; missing original refused; outside-temp, non-directory and linked initial capture refused; malformed paths refused; error output never includes the scratch path.
- Original bare `fs.rmSync(dataDir,{recursive:true,force:true})` **deleted a same-path replacement KEEP file** in a separate disposable Linux fixture (baseline RED).
- Targeted **TypeScript 5.8 NodeNext --strict --noEmit** successfully resolved the new `.mjs` helper through its `.d.mts` declaration in an isolated synthetic importer. This is NOT the root TypeScript7 check.
- Six source-order integration contracts were verified against **the exact private GitHub source fetched by blob**. A new `embedded-postgres-scratch-integration.test.mjs` retains these checks for the full repo. They are structural coverage, not a live PostgreSQL run.

Exact private GitHub files:
- `packages/db/src/embedded-postgres-scratch-ownership.mjs` SHA `88ce1d057c06226307cf7ec0ae60c861bf61cc66`.
- `packages/db/src/embedded-postgres-scratch-ownership.test.mjs` SHA `7ad85e43f96a3e4318c4b5e3dd02433eab681c6e`.
- `packages/db/src/embedded-postgres-scratch-ownership.d.mts` SHA `dd01f85ae8cdfd03fc53a7467b75e7e036fa5c58`.
- `packages/db/src/test-embedded-postgres.ts` SHA `312dbd3502a751b0e2615b9c6c4b9f707ee918c6`.
- `packages/db/src/embedded-postgres-scratch-integration.test.mjs` SHA `52c0e23524b2d6ec0f2f919b9b55174d8ba537d0`.

## Unverified gates / custody

There was **NO native Windows/PowerShell call** in this wave: Remote Desktop Commander previously explicitly reported monthly usage exhausted. Even if the device appears online/paired, do not retry/reconnect or access via a different provider to bypass limits. Previously created **`D:\Bostan-B212-qa`** has native PostgreSQL asset copy completion/inventory/hash **UNVERIFIED** and must be retained for owner-safe review when permitted access returns. Neither that scratch nor any real user files, old QA directories or PostgreSQL processes were changed or removed here.

Issue #234 remains OPEN: genuine repeated native Windows forced-crash PostgreSQL `io_worker` proof with zero owned orphan descendants. Issue #237 remains OPEN: exact-head fully installed compiled native Windows HTTP, Better Auth, first admin/roles/tenant, actual Chromium. Full Linux/macOS/Windows runtime, TS7/Vitest, sandbox/privacy/security/consent and donor LICENSE/NOTICE are NOT qualified. The project stays **NO-GO**; never merge, publish, deploy, enable GitHub Actions or use paid services.
