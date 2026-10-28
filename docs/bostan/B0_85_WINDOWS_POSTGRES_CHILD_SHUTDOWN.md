# B0-85 — Native Windows embedded PostgreSQL test cleanup

**2026-10-28.** Private stacked work on B0-84 PR #233. Bostan stays private, GitHub Actions disabled, no merge to main, publish, deployment, paid inference or user data.

## Reproduced defect and root cause

B0-84 had genuine Windows PostgreSQL 18.1 database tests that returned success but leaked six orphaned postgres.exe io_worker processes. The pinned embedded-postgres library starts Windows taskkill with force/tree switches **without waiting for taskkill completion**; its stop promise can resolve after the main postmaster exits while child workers remain. Source inspection found this in embedded-postgres@18.1.0-beta.16, not in the Bostan database schema.

## Repair in synthetic test fixture only

- On Windows, wrap the existing pinned embedded-postgres constructor for test clients, replacing its stop method with a guarded call to pg_ctl.exe from the **same optional native package** already installed.
- Use PostgreSQL's **fast, graceful, waited** shutdown mode, with fixed non-shell arguments and bounded time. Do not invoke any global PostgreSQL service or force-stop arbitrary PIDs.
- Require a temporary owned PostgreSQL data directory, PG_VERSION identity and an expected pg_ctl.exe name. The stop must remove the postmaster PID marker, or fail closed.
- On Windows, the enclosing test teardown must not delete temporary database files when shutdown failed or timed out. Non-Windows runtime and production PostgreSQL paths are unchanged.
- Add a standalone read-only Windows PowerShell gate to check for processes running from the specific private Bostan test checkout. It cannot terminate processes and is opt-in.
- This mitigates test cleanup only; not a complete production database lifecycle audit.

## Actual receipts

- Native Windows 11, Node 24.19.0, private B0-85 checkout, existing pinned PostgreSQL 18.1.
- A standalone native Windows pg_ctl fast-stop proof: pg_ctl exit **0**, no PostgreSQL processes from the disposable test checkout remaining (the experiment's Node event waiter was subsequently cleaned).
- First actual B0-85 test: selected database connection-pool test **1 PASS, 22 deliberately unselected, exit 0** and **0 owned PostgreSQL processes remaining** after Vitest exit.
- Second actual B0-85 test: database connection pool, reset (stale tables removed), fresh historical migration **3 PASS, 20 deliberately unselected, exit 0**, and again **0 owned PostgreSQL processes remaining**.
- Mac ARM64 Node 26: Windows shutdown unit tests **4/4 PASS**, database TypeScript typecheck and migration safety checks PASS; other focused retry/denial tests 3 PASS and 16 intentionally unselected.
- Live PowerShell no-orphan gate result and final repository/cleanup checks: to be appended after native execution.

## Open

Bostan still requires full authenticated native Windows server+browser acceptance, release installation, complete security/licensing review, and proven free-model agent task completion. **Overall release NO-GO**.
