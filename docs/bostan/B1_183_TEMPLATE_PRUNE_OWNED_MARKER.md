# B1-183 — Fail-closed ownership admission for PostgreSQL template pruning

Date: 2026-11-01 Asia/Riyadh. Private stacked Draft only. Parent: PR #440 at exact `ad7e2c067e44ff16bdc69f6ba29f113a56203f55`. Source/test qualification commit: `8e843ed01c0e6c6fbdad7d77f015f30a8cddc9d2`.

## Actual source finding and repair

`packages/db/src/test-embedded-postgres.ts` previously scanned every old directory below the template cache root and recursively removed it based only on directory type, age and not being the current key. That did **not** establish that an entry was a Bostan-owned, cleanly stopped PostgreSQL template. A preexisting unrelated or retained directory could therefore be deleted during a later template build.

The repair stamps a **newly built, verified-stopped** template with a private regular `.bostan-template-owner` file containing the exact 24-hex template key. Pruning now requires the private root, 24-hex entry name, private usable stopped cluster, exact bounded regular non-hardlinked ownership marker, stale age and stable directory identity recheck. Unmarked older templates, unrelated directories, malformed markers and live `postmaster.pid` entries are retained. Windows marker mode checks correctly avoid POSIX permission-bit assumptions; the preexisting Windows policy still disables template caching while #234 remains open. No old cache entries are retroactively marked or deleted.

## Test-first native evidence

- Mac Apple Silicon Node 26, Vitest 5.0.3, original full private B142 QA checkout: at test-only `f7754d0ff947d3b9ce3e5b6c460ee45f79e40460`, **1 PASS / 1 expected RED**. The old prune deleted the synthetic unmarked directory, causing `ENOENT` for the test-owned sentinel.
- Mac at fixed `26d875d9f0eb02d99812d84cf3ca696cc60bdd48`: **2/2 PASS, exit 0**. Repeated on final source `8e843ed01c0e6c6fbdad7d77f015f30a8cddc9d2`: **2/2 PASS, exit 0**.
- Native Windows 11 Node 24.19, Vitest 5.0.3: preliminary fixed `26d875d9` **1 PASS / 1 RED** because Windows mode bits do not express POSIX marker ownership. After targeted platform correction, exact final `8e843ed01c0e6c6fbdad7d77f015f30a8cddc9d2`: **2/2 PASS, exit 0**.
- Command from `packages/db`: `NODE_OPTIONS=--max-old-space-size=1152 ./node_modules/.bin/vitest run src/embedded-postgres-template-prune.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1` (Windows used `vitest.cmd`).
- Tests create only isolated synthetic `mkdtemp` directories and cleanup only their exact test-owned scratch roots. No PostgreSQL service or child was started by this suite; no actual stale user cache was pruned. The real native template build/publish path, full DB suite and full TypeScript/root gates are **not** qualified by these two cases.

Source blob: `10df6020cd1136b84f4d83f9eb6635a0d8cf1dc2`. Test blob: `b6b75b1d985ca75cb76f5aad2de6e07b07049ec0`.

## Release and host safety

This is a narrowly qualified source safety repair, **not** PostgreSQL force-crash or release qualification. Issue #234 real Windows io_worker forced-crash/no-orphan, #237 SHA-owned compiled Windows HTTP/Chromium, real Linux unprivileged bwrap, full installed 3-OS, tenant/privacy/consent and legal provenance gates remain OPEN. No main merge, Actions, release, publication, cloud, paid provider or customer data.
