# B0-22 — Native PostgreSQL UTF-8 admission for Bostan source runtime

**Status: implementation and tests; pending native Windows proof. Private
development Draft; release NO-GO.**

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
