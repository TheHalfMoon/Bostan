# B0-15 — Real cold PostgreSQL backup → verify → new-HOME restore → reboot → browser

Private Bostan development, October 26 2026. Draft stacked on PR #163 / B0-14. Do not merge into main, deploy, publish, enable inherited Actions, use paid providers, touch installed profiles or remove mandatory legal attributions.

## Significant product gate addressed

B0-08 issue #34 requires real backup and restore after a stopped app, plus readback of persisted data after a crash-safe restart. Prior B0-30 tests validated cross-platform cold-snapshot code with synthetic PostgreSQL status executables, while the source HTTP/Chromium smoke established clean restart in the *same* HOME. Neither qualified the combination of **real PostgreSQL cold backup, cryptographic validation, restore into an independently new HOME, and a successful new database/app/Chromium launch with the exact same company record**.

## New explicit private source scenario

The opt-in `BOSTAN_LIVE_LOCAL_COLD_RESTORE_E2E=1` extends the existing, safe synthetic `BOSTAN_LIVE_LOCAL_QA_CONFIRM=1` source app smoke. Admission requires the actual private Chromium browser opt-in. It refuses mixing backup/restore with native agent/model/provider experiments or the current test-only Node egress preload whose single-HOME audit path does not qualify multiple HOMEs. Everything happens inside one brand-new, private, `mkdtemp` root; never touches a user home, existing database or production port.

The scenario creates a company through Bostan's real private HTTP API, stops both source app and embedded PostgreSQL cleanly, creates a real cold snapshot using `pg_ctl status` as an independent stopped-DB check, verifies content SHA-256 manifest and snapshot tree, restores all payload files into a completely *new* previously nonexistent HOME, checks the critical managed storage/secrets/logging paths are rebased rather than pointing to the source installation, and starts the **restored** Bostan application plus PostgreSQL. The persistent company ID and its synthetic marker must be identical to the original record. Then headless Chromium opens the restored app privately. A clean second stop is required before the only generated root is removed.

The original source HOME and backed-up data are preserved during the test; on failure the exact private temporary root is retained for diagnosis rather than deleting possible running data. Default source smoke remains unchanged.

## Real proof on Mac

- First actual run using installed local PostgreSQL and source Bostan: PASS. Validated and copied **3,420** actual snapshot manifest files; restored into a new HOME and started PostgreSQL from that HOME. Bostan API readback verified exact original company ID and name; headless Chromium source UI mounted, page errors 0, external blocked requests 0. Clean shutdown and owned temp cleanup completed.
- Native Mac focused Node cold-snapshot + source admission tests: **32 PASS, 0 FAIL**.
- Mac broad source Node tests: **182 PASS, 0 FAIL, 10 platform/opt-in SKIP** (192 total).
- Five original canonical JWT/HTTP/independent Case/real PostgreSQL suites: **22 PASS, 0 FAIL**.
- Windows native source results are recorded separately after exact-head verification.

## Not yet qualified

This is cold backup/restore within disposable source checkout, **not** an installed-app upgrade or disaster recovery following hard power loss. It does not exercise Windows packaging, all database migration versions, backups taken while PostgreSQL is running, user secrets from a real account, failed PG shutdowns or stale locks, nor the official full server compiler/build. Native free-model-generated independently reviewed canonical Case and independent comprehensive security signoff remain open. **Release NO-GO**, private and no paid inference.

## Final branch regression results

- Native Windows Abdulaziz Bostan Node source: **184 PASS, 0 FAIL, 8 platform/opt-in SKIP** (192 total); the new admission test passes. No Windows installer or live restore was claimed.
- Canonical independent Case/JWT/native runner/real disposable PostgreSQL: **22 PASS, 0 FAIL** (five integration files).
- Default source path (without cold restore flag) was rerun on Mac under both explicitly opted-in test-only network guards: PASS, two server processes armed, 0 recorded external Node API calls, 0 browser errors and 0 blocked browser requests. Thus the optional restore path did not regress ordinary restart/persistence/Chromium smoke.
- Full official server compiler/build, Windows installed app and hard-power-loss recovery remain unqualified.
