# B1-184 — Require an owned, stopped template before PostgreSQL cache reuse

Date: 2026-11-02 Asia/Riyadh. Private stacked Draft only. Exact parent: PR #441 at `214d21946a5dd2910f7e608061d66a24b5c8e2ba`.

## Source finding and fix

B1-183 stamped only newly built, verified-stopped PostgreSQL template caches and refused to **prune** unmarked/foreign directories. However, `getEmbeddedPostgresTemplateDir()`, its post-build check, the existing-template rename-collision path and the copy/start retry still accepted an unmarked directory with a private mode, `PG_VERSION`, and no `postmaster.pid`. The support probe could even return `supported: true` for an unmarked preexisting template without starting PostgreSQL. That directory had no Bostan-owned, stopped-template provenance.

This repair uses the existing strict `.bostan-template-owner` marker/key/regular-file/non-hardlink/stopped-cluster predicate for **both reuse and pruning**. Old unmarked cache entries remain untouched and are not promoted or retroactively marked. When a conflicting old directory prevents publication, the cache falls back to a fresh cluster rather than trusting that entry. The Windows cache remains disabled under issue #234. No native PostgreSQL stop, process signaling, customer data, or application HTTP behavior was modified.

## Native test-first evidence

- Test-only commit `8eb07f2abebfb9f196fe2b01d0fe7e3d36e50058`: Mac Apple Silicon Node 26 / Vitest 5.0.3, **1 expected RED / 2 filtered SKIP**, exit 1. The pre-fix source incorrectly returned `supported: true` for a synthetic unmarked directory while the injected native constructor was unavailable.
- Source repair `6c9910caa2544f57fb29f6f4e9674e8608dc2911`: Mac Node 26 / Vitest 5, **3/3 PASS**, exit 0. The new case checks refusal without native PostgreSQL and acceptance after writing the exact synthetic marker; two existing B1-183 pruning cases still pass.
- Final test portability commit `031b63b12ae9a93f69587ec50cec8c60d5866e78`: Mac **3/3 PASS**, exit 0, and Windows 11 Node 24.19 / Vitest 5 **2 PASS / 1 platform SKIP**, exit 0. Windows skips only the POSIX cache-reuse case because template caching is deliberately disabled there; its two synthetic prune cases pass.
- Commands in `packages/db`: `NODE_OPTIONS=--max-old-space-size=1024 ./node_modules/.bin/vitest run src/embedded-postgres-template-prune.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1`; Windows used `vitest.cmd`. Mac free-memory admission was 35–37%; Windows was 5.79 GiB. No real PostgreSQL launched.
- Mac pre-existing `Bostan-B142-qa` restored exact detached `88e0274412c2e6cbadd07534960b20184907f291` CLEAN. Windows pre-existing `Bostan-B111-qa` restored exact detached `4a367c57e4a40c06dad2befd7de5a6ff43bd6081` CLEAN, `postgres.exe` count zero. No new clones, dependency installs, shared cache deletion, or foreign process termination.

## Qualification limits and release

Synthetic owned scratch/constructor injection only; this does **not** prove actual native template build/publish, POSIX long-stop, Windows forced-crash io_worker cleanup (#234), freshly compiled Windows authenticated HTTP/Chromium (#237), full TypeScript/Vitest, unprivileged Linux bwrap, installed three-OS, tenant/consent/privacy/security or legal attribution gates. **RELEASE NO-GO**. Never merge main, enable Actions, release/publish/deploy, use paid/cloud services, customer data, or delete unowned/retained evidence.
