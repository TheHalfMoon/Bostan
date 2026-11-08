# B1-231 — Minimal child environment for isolated local PostgreSQL qualification

Date: 2026-11-07 (Asia/Riyadh). **PRIVATE DRAFT / UNMERGED / RELEASE NO-GO.**

## Actual sensitive environment inheritance

The original `scripts/bostan-local-postgres-isolated-env.mjs` inherited **every string-valued ambient environment variable**, except names starting with `PG` and `DATABASE_URL`/`PAPERCLIP_CONFIG`. That protected the libpq connection target but still copied unrelated API keys, GitHub tokens, native dynamic loader hooks and Node startup hooks directly into `spawnSync` children including PostgreSQL CLI and the `pnpm migrate` task.

**Real isolated baseline reproduction**: exact original GitHub module blob `b74b3ad80dc877c0b38683c5b74c4170b207be15` was reconstructed and `git hash-object` checked in a Linux Node22.16.0 QA workspace. With synthetic `OPENAI_API_KEY`, `GITHUB_TOKEN`, `LD_PRELOAD`, and `NODE_OPTIONS` set on the supplied ambient object, all four fields were present in the generated child environment. These were synthetic fixture strings, not real credentials.

## Implementation

The builder now inherits only a fixed case-insensitive allowlist of cross-platform runtime variables needed for command discovery, home/temp directories, locale and native Windows process startup (such as `PATH` / `Path`, `HOME`, `TEMP`, `SystemRoot`, `ComSpec`, `APPDATA`, `PNPM_HOME`). It refuses case-folded duplicate allowed keys, prevents embedded NUL values and skips nonstring allowed values. It never inherits `OPENAI_API_KEY`, `GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, `NPM_TOKEN`, `NODE_OPTIONS`, `NODE_PATH`, `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, `BOSTAN_CLOUD_*`, unknown app secrets or unmanaged `PG*`.

It separately pins `PGHOST`, `PGHOSTADDR`, `PGPORT`, `PGUSER`, `PGDATABASE`, synthetic localhost `DATABASE_URL` and a deliberately absent `PAPERCLIP_CONFIG`. Existing invalid-port/user/database/path validation, non-mutation of source environment and allowed `Path` casing are preserved. This changes only the local PostgreSQL **qualification** child environment builder, not the production server environment.

This is **not sandboxing**. Allowed `PATH`, `HOME`, `ComSpec` and toolchain directories can still reference untrusted files; command provenance and filesystem isolation are separate release qualifications. A genuine fully installed Windows/macOS/Linux package-manager and PostgreSQL run is needed to ensure the narrower environment is sufficient for that host. Never silently restore arbitrary inherited environment as a workaround.

## Executed evidence

- Exact original module Git blob `b74b3ad80dc877c0b38683c5b74c4170b207be15`: reproducibly copied synthetic API key, GitHub token, native preload, and Node hook values to the child environment.
- Exact fixed module Git blob `07547b2b2f2a8e2f2d7477be6ee8dfb92c4dfaec`, independently matched with local `git hash-object`.
- Exact existing seven-case test suite Git blob `6b7676108a96af8a9322834da4e59010cba61bf5`, independently matched and actually executed in the same isolated Node22 runner.
- New exact privacy test suite Git blob `be5f0e228d2a838b93b7dcc14479e298f1169d94`, independently matched and actually executed, including a real Node subprocess receiving the synthesized minimal environment and returning a list of inherited secret key names (empty).
- **14/14 Node22 tests PASS, zero skip, zero fail, exit0** across old and new test suites. This is a focused child-environment qualification only; not full product TypeScript7/Vitest, real PostgreSQL migration, native Windows PostgreSQL/Chromium or installed application acceptance.

## Remaining NO-GO

Native Windows #234 actual repeated PostgreSQL18.1 forced-crash `io_worker` process cleanup and #237 fully compiled SHA-owned authenticated Windows HTTP/Better Auth/tenant/Chromium remain open. Real macOS/Linux PostgreSQL, root TS7/Vitest, Linux sandbox, native app packages, cross-platform E2E, privacy/security/consent and donor LICENSE/NOTICE are not qualified. Remote Desktop Commander earlier explicitly reported a monthly usage limit and instructed not to retry/reconnect; this was not circumvented. Previously staged `D:\Bostan-B212-qa` native PostgreSQL binary copy remains intentionally untouched and unverified. No customer data, user processes or foreign files accessed or modified. No merges, Actions, public release or paid provider use.
