# B1-101 — Fail closed when an HTTP transport never acknowledges abort

Date: 2026-10-31 Asia/Riyadh. STRICT PRIVATE / ZERO COST / NONPUBLISHING.
Exact stacked parent: open Draft #355 at `0c8fff21f190dde6e1266e2a0d53875dc7fc1bca`.
Scope: `server/src/adapters/http/execute.ts` and synthetic HTTP tests only.

## Reproduced RED on unchanged B1-99 parent

The adapter propagated cancellation and deadlines to AbortSignal, but still
awaited the transport to resolve or reject. A transport returning a permanently
pending Promise ignored AbortSignal and left the caller running forever.
Two new synthetic regression tests were RED: a finite request deadline returned
`still_pending` instead of `timeout`; owner cancellation with no configured
deadline returned `still_pending` instead of `cancelled`.
No network traffic, provider credentials, PostgreSQL, or customer data.

## Minimal change and guarantees

Start the existing guarded fetch with unchanged URL, headers, payload, DNS/SSRF
guard and AbortSignal. While it is pending, race its settlement with the
per-invocation controller's abort event. The recorded first abort origin from
B1-99 remains the sole authority for the result: deadline produces the same
redacted `timeout` and owner stop produces the same `cancelled`. An abort
wait listener is detached in a finally block. A settled or late rejection is
observed without leaking its untrusted message. If a transport resolves only
after this run has returned following abort, its unused response body is
cancelled best-effort, without awaiting the peer or disclosing its diagnostics.
Existing regular-response body cancellation remains unchanged.

The earlier test that waits for a deliberately later owner abort was updated
to await that separate event loop turn after the now-prompt timeout verdict;
its first-origin and redaction assertions remain intact.

This does not prove that a hostile custom transport actually closes its own
socket when ignoring AbortSignal. It ensures the run verdict and caller are no
longer trapped waiting for that transport.

## Mac native reproducible evidence

Node v26.0.0, existing installed pinned Vitest v5.0.3, one fork worker,
1024 MiB Node heap, no dependency installation:
- RED before fix: 2 new tests FAIL / 20 filtered out, confirming hang.
- GREEN exact source: three focused HTTP suites 30/30 PASS (execute 23,
  actual loopback socket 3, HTTP setup 4); no skips.
- Targeted strict TypeScript7 check on `src/adapters/http/execute.ts`:
  `tsc --ignoreConfig --noEmit --target es2023 --module nodenext
  --moduleResolution nodenext --strict --skipLibCheck --types node`
  EXIT 0, no diagnostics.
- `git diff --check` PASS.

A broader exploratory suite returned 73 PASS / 1 FAIL in
`src/adapters/registry.test.ts` (native ACPX missing-package check expected
the phrase 'Reinstall or rebuild' but got 'The ACPX runtime could not be
verified.'). No registry files were modified. That exploratory check is
NOT claimed green or repaired in this PR.

## Gate status

This is source-level Mac qualification of one HTTP cancellation bug, not a
full Bostan installed-product, native Windows, Linux, PostgreSQL, Chromium,
security/privacy, agent-effect consent, license/NOTICE, or high-load release
qualification. Release remains **NO-GO**. Keep repository PRIVATE, PR DRAFT,
stacked and unmerged. Do not enable Actions, deploy, publish, npm pack,
use paid compute or models, or access customer data.
