# B1-201 — Private Windows QA PostgreSQL URL admission

## Source-backed issue
The Windows localhost HTTP QA environment builder previously admitted any `postgres://` or `postgresql://` URL with an IPv4 loopback hostname and high port. A different pre-existing local database name, arbitrary connection options, missing credentials, or URL-normalized path could be forwarded as `DATABASE_URL`. This was an unsafe preflight shape, **not evidence that customer data was accessed**.

The native QA runner creates a synthetic `paperclip` database through `startEmbeddedPostgresTestDatabase`. The environment builder now refuses database URLs unless they have a literal canonical `/paperclip` path, nonempty username/password, no query or fragment, a canonical unchanged URL spelling, the existing IPv4 loopback hostname, and the existing high-port bounds. The existing source caller's URL remains admitted.

## Native isolated test-first evidence — 2026-11-02
- Repository parent source blob: `2494beb58bea83de7b68bd06087890aab95762d5`.
- Linux Node 22.16.0, isolated source-matched fixture: 6 new tests before repair, **2 PASS / 4 expected RED**, exit 1. Rejections missing for alternate local database names, connection options/fragments, absent credentials, and encoded database paths.
- Fixed source blob: `e0538606cab005616c0af1fe548651bb71285faf`.
- Committed new test blob: `23633b0a27a1eef77ca4db38c72f2c8afbc812b5`.
- Original existing test blob: `4203a6903490eff07339928ba8a488c9d1b034cd`.
- After repair: **7/7 new tests PASS** and **5/5 existing environment tests PASS** in one native Node test invocation: **12/12 PASS, zero skips, exit 0**.
- `node --check` passed for changed source and new test.
- Only an exclusive, tiny local QA directory was used; no PostgreSQL, browser, remote device, user file, or foreign process was touched.

## Boundaries and release status
This is a fail-closed URL-shape check, **not attestation of a database process's ownership**, a live PostgreSQL acceptance run, or Windows-native qualification. A pre-existing local database could still have the same name/port; the owned PostgreSQL fixture and process safety gates remain necessary. No full root TS7/Vitest, compiled authenticated HTTP/Chromium #237, repeated native Windows forced-crash #234, or installed three-OS acceptance was performed. The private stacked PR remains Draft and unmerged. **RELEASE NO-GO.**
