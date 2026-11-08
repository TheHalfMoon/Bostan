# B1-179 — Source HTTP workspace dependency preflight

Date: 2026-11-01 Asia/Riyadh. **Private, zero cost, Draft PR only, release NO-GO.**

## Verified failure being addressed

A genuine earlier Windows 11 source-mode HTTP attempt on exact private Bostan Draft #436 HEAD `ebab45467bfa8005bb63428b4dd54ba6d3ce32e1` started real PostgreSQL, applied migrations, loaded 5,380 TypeScript modules, and then failed to start the HTTP server with a privacy-safe `ERR_MODULE_NOT_FOUND` diagnostic for `smol-toml`. The package was correctly declared in the server, adapter-utils and paperclip-runner manifests and in the shared lockfile; the **temporary QA checkout had not been provisioned with all package-scoped dependency links**. The failed attempt exited 1 after ~133 seconds of server probes, then confirmed zero PostgreSQL orphans. Thus it was an incomplete QA environment, NOT an established production missing dependency.

## Scoped repair

The `--run` (source-only) Windows localhost HTTP test now checks three source-workspace import scopes BEFORE `mkdtempSync`, startup of a PostgreSQL cluster, or spawning the server:

- `server`
- `packages/adapter-utils`
- `packages/paperclip-runner`

For each scope, inspect a bounded ordinary (not symlink) `package.json`, verify `smol-toml` is a declared dependency, then use native `createRequire(package.json).resolve('smol-toml')` from that exact manifest. If any inspection or actual Node resolution fails, exit code 2 and emit only `BOSTAN_WINDOWS_LIVE_SOURCE_DEPENDENCIES_REFUSED=<finite_reason>`. Never print local paths, import errors, workspace package contents, user settings, connection strings or secrets. The compiled route is unchanged and still requires its existing SHA-owned runtime gates; source preflight success does NOT qualify compiled output.

## Actual red/green and native evidence

The source was authored and exercised via independent Node 22 fixture tests before integration: **6/6 PASS** (missing package from every required scope; declared-but-not-installed real resolution failure; actual local package resolution positive control; malformed/missing/undeclared manifests; invalid root; privacy-safe receipts).

The final exact GitHub branch files were then fetched into an **exclusive clean full GitHub source checkout on Windows 11**, native Node **v24.19.0**, HEAD `bab10f038a74a474412a2b4e2088faef0486b2f2`. No borrowed or installed package dependencies were needed to run the self-contained Node test.

- `node --test --test-reporter=spec scripts/bostan-private-windows-source-workspace-admission.test.mjs`: **7/7 PASS, zero skip/failure, exit 0, duration ~371 ms**, including static ordering assertion that the actual live HTTP harness calls the preflight before allocating PostgreSQL scratch data.
- Native Windows negative live-harness integration: with intentionally absent installed workspace dependencies in the exact clean checkout, exclusive empty `D:\\Bostan-B204-temp` and no PG at startup, `node scripts/bostan-private-windows-live-http.mjs --run` emitted `BOSTAN_WINDOWS_LIVE_SOURCE_DEPENDENCIES_REFUSED=missing_workspace_dependency`, **exit 2** as designed, **zero** PostgreSQL processes afterwards, **zero** scratch entries, and **clean Git**. No database, port, child process or user data was touched by this negative test.
- An attempted external package junction provisioning command was refused by the host safety check; it was **not bypassed**. This PR does not change manifests or install packages, and must not be misrepresented as a successful HTTP/Better Auth run.

## Still release NO-GO

#237 freshly SHA-owned Windows compiled server, real authenticated HTTP/Better Auth signup/first admin and Chromium journeys remain open. #234 deliberate real Windows forced-crash `io_worker` repeated zero-orphan proof remains open. Full root TypeScript, Linux sandbox, installed apps, tenants/security/privacy/consent and donor license review are also unqualified. The previous *graceful* native Windows parallel PostgreSQL migration test was **2/2 PASS** on #436 but is not evidence for the forced-crash gate. Do not merge main, run GitHub Actions, publish, deploy, use paid services, or delete retained/foreign fixtures.
