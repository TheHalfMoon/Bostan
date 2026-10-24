# B0-22 — Native PostgreSQL UTF-8 admission for Bostan source runtime

**Status: native Windows UTF-8 PostgreSQL and one complete synthetic
Bostan agent workflow QUALIFIED. Private development Draft; release NO-GO.**

## Root cause independently verified

On the authorized Windows computer, a private PostgreSQL 17.11 server in
an explicitly opted-in disposable Bostan TEMP HOME reported:

- `server_encoding=WIN1252`, `client_encoding=WIN1252`.
- Database collation and ctype `English_United States.1252`.
- Bostan first-agent heartbeat failed at `runtime_prepared` while
  reconciling bundled `company_skills`. SQLSTATE **22P05** is
  PostgreSQL's untranslatable-character error. The model provider had not
  started and its direct free-model admission had independently passed.
- Replaying the same bundled inventory importer outside the heartbeat
  reliably reproduced the `22P05` SQLSTATE with `PostgresError` as
  its immediate cause. This rules out the heartbeat lease-release fallback
  as the root of the insertion failure.
- A disposable transactional ASCII-only INSERT/ROLLBACK into the same
  table passed. Skill import input used non-ASCII Unicode characters,
  which the default Windows locale database could not store.

## Implementation

- Every newly initialized source-managed cluster passes
  `initdb --encoding=UTF8 --locale=C` explicitly, so an English/ANSI
  Windows locale cannot create a WIN1252 local Bostan database.
- The runtime queries PostgreSQL's actual database encoding after starting
  it, first for the system `postgres` database and then for Bostan's own
  application database. Both **must equal UTF8** before the server child
  is launched or application migrations run.
- A preexisting non-UTF8 cluster is **NOT reset, deleted, converted, or
  force-reinitialized**. The runtime fails closed with backup/migration
  guidance. Normal teardown verifies PostgreSQL stopped before clearing
  only the managed runtime lock.
- Using locale C makes initial collation deterministic on all supported
  native platforms but does not supply language-aware sorting. Locale and
  collation migration remains a distinct future compatibility gate.

## Test limits and release gates

Pure Node regression checks assert explicit initdb flags and strict
non-UTF8 rejection, alongside lock/recovery and first-agent tests.
Native Windows qualification still must prove a fresh database actually
reports UTF8, accepts Unicode skill text, and rejects an old WIN1252
cluster without changing its data. Only a **separate** full Windows
first-agent issue/comment/heartbeat E2E can qualify the original blocked
agent workflow.

No deployment, paid provider, public release, main merge or Actions.

## Native Windows proof — October 24, 2026

Tested the code on branch `work/b0-utf8-postgres-admission`,
commit `f29e6b33e420eaf3ae86686b732ba1876ffb136c`, against **actual**
Node 24.19, PostgreSQL 17.11 and a new disposable protected Windows TEMP
HOME. No normal user database, credentials, workflow, or paid provider.

1. Ran **36 passing Windows Node tests**, zero failures, six POSIX-only
   skips. On Mac, the same four-file test set passed **42/42**.
2. Started the **previous** intentionally preserved WIN1252 TEMP cluster.
   The updated runtime refused it with an explicit `not UTF8` error,
   returned exit code 2, did not launch a Bostan server, and stopped the
   cluster with its managed runtime lock removed. The old database
   directory remained intact; no destructive conversion or delete.
3. Launched a **new** Windows TEMP HOME. Genuine PostgreSQL system and
   `bostan` application databases both returned
   `pg_encoding_to_char(encoding) = UTF8` and system collation `C`.
   Bostan returned `/api/health: ok`, private, local_trusted.
4. Re-ran the actual bundled skill inventory importer directly against the
   new database: **10 skills imported successfully**, exit code 0. The
   same importer on the old WIN1252 cluster had reproducibly failed with
   `PostgresError` SQLSTATE `22P05`. This is an independently verified
   correction of the Unicode blocker.
5. Created one synthetic Bostan `opencode_local` agent through the API
   using an allowlisted free-labeled online DeepSeek model. The full
   first-agent QA script stopped at its **90-second agent lifecycle
   readiness timeout**; the same agent independently reached `ready`
   shortly after. There were **zero heartbeat runs and zero issue rows**
   at the time of that first timeout.
6. Reused that **same** ready agent, without creating another agent or
   invoking a previously attempted task. A separate, bounded source QA
   script created one synthetic assigned issue and invoked one heartbeat.
   Verified the real run progressed through `dispatching` and ended as
   **`succeeded`, exitCode 0, errorCode null**. The issue became **`done`**
   and one task comment contained the exact synthetic completion marker.
   The complete task QA process exited 0 after approximately **55.54s**.
7. The source E2E now allows a **bounded 240-second Windows-only**
   lifecycle readiness check, retaining 90 seconds on macOS/Linux.
   The full first-agent script with this new timeout has its own remaining
   regression gate; the fully successful run in item 6 was a separate
   explicit existing-agent API E2E.

**Conclusion:** database Unicode compatibility and a real first Windows
agent issue/comment/heartbeat cycle are proven. Do not overstate this as
consumer installer, production privacy, offline model, or repeated mixed
workload qualification. Cold Windows source startup is still slow and
product-level user setup remains unsupported.
