# B1-230 — Redact local PostgreSQL child failures in qualification output

Date: 2026-11-07 (Asia/Riyadh). **PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO**.

## Actual privacy exposure

`scripts/bostan-local-postgres-migration-qualification.mjs` previously threw:

```js
const tail = String(result.stderr || result.stdout || result.error?.message || '').slice(-1200);
throw new Error(`${command} failed (exit ${result.status ?? 'unknown'}): ${tail}`);
```

The outer test runner prints the thrown error message. Child stderr, stdout, and spawned binary paths are not trustworthy diagnostic data. A failed synthetic PostgreSQL CLI, migration process, native child or maliciously shadowed command may include connection strings, credentials, private filesystem paths or SQL data in those outputs. Taking the last 1200 characters is a length cap, **not redaction**. The failure path forwarded raw child data into the parent log.

## Implementation

New standalone, dependency-free, test-only `scripts/bostan-local-postgres-cli-failure.mjs` projects errors into a fixed, bounded diagnostic composed exclusively of:

- An allowlisted command type (`initdb`, `pg_ctl`, `createdb`, `psql`, `pg_dump`, `pg_restore`, or `pnpm`), otherwise `other`.
- A bounded integer exit code 0–255 or `unknown`.
- A fixed allowlist of well-known OS error codes (`ENOENT`, `EACCES`, `EPERM`, `ETIMEDOUT`, `E2BIG`, `ENOBUFS`, `EAGAIN`) and signals, otherwise `unknown` or `none`.

It **never** includes stdout/stderr, the executable's untrusted path, arguments, environment variables or thrown child error messages.

An additional adversarial regression exposed a flaw in the first version of this formatter: it accessed `error.code` **three times**. A custom getter could return an allowlisted value during validation and a sensitive string on the third read, which was then projected into the error message. The fixed implementation reads that property **exactly once** and validates the same captured primitive. Two new real tests require one getter read and prove that neither a changing allowlisted-then-secret nor secret-then-allowlisted value leaks. Original formatter blob `ba3e3fa5c08a8b44d0f1a6f7238e42a67d3040bf` must NOT be qualified as safe. The real runner's `exec` catches synchronous spawn exceptions and projects returned nonzero/errored child results through that formatter. Successful child output is still returned unchanged because existing migration and database round-trip assertions require it. No subprocess creation, CLI arguments, PostgreSQL lifecycle or deletion semantics were otherwise changed.

This fixes the **failed-child message path**. It does **not** prove the entire qualification runner or all imported modules redact every possible error; other thrown exceptions and process output elsewhere still require security review. Nor does it solve executable provenance, PATH shadowing or actual native PostgreSQL acceptance.

## Executed evidence

- Old source GitHub blob `adbff18e4b6c165567491116ac4360c457b0d312` includes raw child-error tail interpolation.
- Updated real runner source GitHub blob `7c18ce7383b11af0c3a149f1de59caa7b919406b`; independently fetched and inspected, verifies the formatter is imported, raw tail no longer appears inside `exec`, and both returned child errors and synchronous spawn exceptions use the formatter.
- Formatter blob `3693ab7a970057e6d4e8a83f84eff4d03c3f7cee` and its 10-test blob `a55b940e1f5f7c5cf841d7ed6e2409acd719c270` were independently `git hash-object` matched with private GitHub and tested using actual Linux Node 22.16.0 subprocesses: **10/10 PASS**. Covered a real subprocess writing a synthetic credential-bearing URL to stderr and exiting 42, a real subprocess writing the URL to stdout and exiting 16, unknown executable path containing the secret, invalid exit, error codes/signals, hostile getters and bounded output.
- Integration regression `scripts/bostan-local-postgres-cli-failure-integration.test.mjs`, exact blob `38edc4eddd446519507838ddef761e866bfa8361`, independently hash matched and executed with the **exact current `exec` function text reconstructed in an isolated fixture** and injected in-memory `spawnSync` outputs. **5/5 PASS**, verifying child stdout+stderr redaction, thrown error redaction, timeout code, successful migration output and source contract. This does not count as a full checkout test: the local fixture contained only the exact extracted `exec` body rather than the entire 12KB runner.
- Combined local 15 privacy tests and the 12 exact GitHub B1-229 preexec tests: **27/27 PASS, zero skips or failures, exit0**. B1-229's preexec helper and tests independently matched GitHub blobs `c4a1b4cb983528ea6d82df8e6bd7f48e0a3c81e0` and `a43f7d44903320616e29b22df8675af1c1210cc3`. **No native PostgreSQL service or actual product checkout E2E was run**.

## Remaining qualification / restrictions

The pre-existing Desktop Commander provider returned a monthly usage limit and expressly asked not to retry or reconnect. We did not use it or any alternative path to evade the restriction. The previously staged exclusive `D:\Bostan-B212-qa\native` PostgreSQL assets have an unverified final inventory/hash/cleanup state and remain intentionally untouched. No real Windows, Linux or macOS PostgreSQL server, compiled localhost HTTP, Better Auth, Chromium, full root TS7/Vitest, packaging or paid service was used.

Release remains **NO-GO**. Issue #234 still requires repeated actual native Windows forced-crash `io_worker` zero-orphan evidence and safe teardown; #237 requires a clean SHA-owned compiled native Windows HTTP/Better Auth/first-admin/tenant/role/Chromium run. Also unqualified: real Linux/macOS PostgreSQL migration/cache, Linux sandbox, installed three-OS acceptance, security, privacy, consent and donor LICENSE/NOTICE provenance. Keep repository PRIVATE. Do not merge to main, enable Actions, publish, deploy or release.
