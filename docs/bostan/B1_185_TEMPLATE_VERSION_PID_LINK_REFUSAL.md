# B1-185 — Refuse linked PostgreSQL template version files and dangling PID markers

Date: 2026-11-02, Asia/Riyadh. Private TheHalfMoon/Bostan, zero cost, DRAFT ONLY, unmerged, overall RELEASE NO-GO.

## Actual source bug

Private stacked Draft PR #442 at exact parent commit `fd6db99db7d6477a8e2794d3e7c94c59c3a68580` introduced an owner-marker requirement for POSIX PostgreSQL template **reuse**. Its subordinate `isUsableTemplate(dir)` still checked:

```ts
fs.existsSync(path.join(dir, "PG_VERSION")) && !fs.existsSync(path.join(dir, "postmaster.pid"))
```

`existsSync` follows symlinks, so a `PG_VERSION` symlink to a readable file outside the template directory was deemed a valid version marker. A hardlinked version marker was also accepted. Conversely, a **dangling** `postmaster.pid` symlink was treated as absent even though a PID marker inode was present. These observations cannot prove that a cached directory is a self-contained, stopped native cluster. The #442 owner-stamp verifies only the stamp; it does not make all data files safe.

## Focused source fix

- Only accept an ordinary, non-symbolic, single-link `PG_VERSION` with bounded size 1–32 bytes using `lstatSync`.
- Treat **any** object at the `postmaster.pid` path, even a dangling symlink, as not-stopped. Only a genuine `ENOENT` from `lstatSync` establishes marker absence; any inspection failure refuses the cache.
- Existing root user-ownership checks, owner-marker checks, Windows template-disabled policy, staged native stop, and **fresh cluster fallback** remain unchanged. Unverified cache data is retained, never unlinked or pruned based on this check. This does not add process termination.

## Actual test-first evidence

Native Mac arm64 Node v26, Vitest v5.0.3, selected synthetic-only `src/test-embedded-postgres.test.ts` tests against **exact private #442 GitHub source blob** `bcfbdb93f9265b8949500d185cfd1501b67b0219`, independently verified with native `git hash-object`. Isolated small B205 QA copy of a previous 21MB partial source checkout with modified source/test files overwritten by the exact #442 GitHub versions; preinstalled B135 dependencies linked in QA only. No downloaded model/cloud or user data.

- New tests: linked `PG_VERSION` symlink, hardlinked `PG_VERSION`, dangling `postmaster.pid` symlink, and a `postmaster.pid` directory control. With pre-fix source: **3 RED / 1 PASS, exit 1**; genuine false-positive template admission, not merely a mocked assertion. The directory control already correctly refuses the marker.
- Source fixed as above; focused `isUsableTemplate` suite: **7/7 PASS, 15 filtered/skipped, 0 failures, exit 0**. Includes normal stopped cluster, working directory-level symlink refusal, and POSIX directory mode cases.
- Native targeted TypeScript7 `--ignoreConfig --noEmit --strict --skipLibCheck --target ES2023 --module NodeNext --moduleResolution NodeNext --types node src/test-embedded-postgres.ts`: **exit 0**.
- Final exact source GitHub and native blob `d4d31f134ea4fe4659d56d111b748cee4eba0452`; final tests `cce6c86f2ff2934e43a0acc601c8813ead5cada3`.

This is a **Mac native selected source/test unit regression**. The QA copy is partial and was SHA-pinned for the changed source/test only. No full root/server TypeScript7, native Linux integration, native Windows cluster with cache enabled, actual PostgreSQL template build under load, compiled server, installed app, or Chromium were qualified. The Windows template cache is intentionally disabled while #234 forced-crash orphans remain open.

## Remaining release blockers

#234 genuine Windows forced-crash PostgreSQL `io_worker` multi-round zero-orphan and owner non-interference; #237 freshly SHA-owned compiled Windows HTTP/Better Auth/Chromium journeys; POSIX actual long-stop and concurrent cache mutation proof; full CI/root/server TS7, native Linux unprivileged bwrap, installed apps and consent/tenant/privacy/security/license provenance. RELEASE NO-GO. Never merge main, enable Actions, publish/deploy/release, use paid services, remove foreign/retained scratch or kill foreign processes.
