# B1-177 — Windows PostgreSQL marker hardlink ownership refusal

Date: 2026-11-01 Asia/Riyadh. Private, zero-cost, OPEN DRAFT ONLY, unmerged, release NO-GO.

## Why the change is needed

The existing test-only Windows embedded PostgreSQL shutdown helper `packages/db/src/windows-embedded-postgres-stop.ts` verified `PG_VERSION` and `postmaster.pid` are ordinary nonsymlink files and pinned their identity/bytes before calling `pg_ctl` or declaring binary quiescence. However, a single inode with multiple hard links could also be observed under a separate pathname, allowing apparently owned marker bytes to be shared outside the scratch cluster. This ambiguity violates the refusal-to-touch-unowned-data contract. It also could emerge **during** asynchronous CIM process inspection without changing inode identity or marker bytes. This is an ownership safety hardening, **not** a claim that the original six Windows `io_worker` orphan processes in #234 are resolved.

## Source repair

- Require exact `Stats.nlink === 1` for initial `PG_VERSION`, all subsequent `PG_VERSION` identity checks, and for `postmaster.pid` presence checks.
- Require exact single-link PID marker at pre-open lstat, descriptor fstat, path-restat and the last post-CIM pre-shutdown restat. On link ambiguity the function rejects with an existing generic marker/identity error and retains the fixture.
- The pinned binary, `pg_ctl` invocation, process quiescence proof, live PostgreSQL service, and Windows process termination behavior are otherwise unchanged. No kill or unowned cleanup introduced.

## Test-first and native OS evidence

Candidate stacks directly on #434 exact head `caef1681243ac91ac96109289b364477083488c3`. Tests begin with the original exact #434 blobs.

- Native Mac Node 26, Vitest 5, isolated synthetic-only source copy using preinstalled dependencies: **4/4 added tests RED** on original code (two pre-existing hardlinks and two hardlinks introduced in asynchronous CIM inspection; original helper produced false `stopped`/`already-stopped` receipts). All RED test cases used only fake process metadata; no PostgreSQL launched.
- Fixed exact candidate source SHA `c3ca429ba343b92d63e3ffdf0d0f4e95c9b7e7c4` and test SHA `9bf842058dee98e2c73b1ff7c6bd461f9bf086d5`; both `git hash-object` matched native Mac QA copies and the private GitHub blobs.
- Native Mac full scoped `windows-embedded-postgres-stop.test.ts`: **58 PASS / 1 SKIP / 0 FAIL, exit 0**. Skip was pre-existing and platform-conditioned; no assertion that all Windows tests run on Mac.
- Native Mac targeted TypeScript 7 `--ignoreConfig --noEmit --strict --skipLibCheck --target ES2023 --module NodeNext --moduleResolution NodeNext --types node` on modified source: **exit 0**.
- Native **Windows 11 / Node 24.19.0**, independent source blob hash **c3ca429ba343b92d63e3ffdf0d0f4e95c9b7e7c4**, with `--experimental-strip-types` and wholly owned **D:\\Bostan-B202-qa** synthetic fixture, owner-controlled TEMP and native NTFS hard links: **5/5 PASS, exit 0** (4 unsafe hardlinks/races + 1 ordinary PID marker/pg_ctl fake-signal baseline). Zero actual `postgres.exe` processes in postflight. The native Windows test ran without real PostgreSQL, without downloads or paid services.

## Still unqualified

Windows real forced-crash PostgreSQL `io_worker` + process-tree quiescence (#234) needs a separate **native live** isolated test and repeated no-orphans evidence when resource/ownership preflight permits. Full fresh SHA-owned compiled server HTTP/Better Auth/Chromium (#237), actual POSIX prolonged stop, root TS7, integrated Windows Vitest repeat, native Linux sandbox, installers, security/privacy, consent, tenant tests and license provenance all remain unqualified. This fix must not be used to assert the app is production ready.

No main merge, GitHub Actions, public release or deployment. Scratch data and foreign processes must be retained if identity is unverified.
