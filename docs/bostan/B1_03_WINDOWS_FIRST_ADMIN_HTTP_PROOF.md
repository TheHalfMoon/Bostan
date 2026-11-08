# B1-03 — Windows real private HTTP first-admin identity and evidence gates

Date: 2026-10-28. **PRIVATE Bostan, stacked Draft**, no merge, publication, deployment, GitHub Actions, paid providers or customer data.

## Found weakness

The native Windows authenticated HTTP smoke on B1-02 could mark success after signup HTTP 200 and first-admin claim HTTP 200 without verifying whether the session was actually the newly created synthetic user, whether the claimed admin identity matched, whether an anonymous user could claim, whether the new CSRF origin guards denied cookie-bearing foreign-origin requests or whether a repeat first-admin claim was refused. The final receipt also lacked exact ordered security-event evidence that independently fails closed on a missing stage.

These are **missing QA assertions**, not proof that the production server had granted unauthorised access.

## Changes

1. The actual Windows localhost PostgreSQL/auth HTTP runner `scripts/bostan-private-windows-live-http.mjs` now requires the following real HTTP responses:
   - `GET /api/health` 200 with authenticated/private deployment, `bootstrap_pending` and no Cloud field.
   - No-session same-origin `POST /api/bootstrap/claim` **401**.
   - Synthetic Better Auth signup **200**, session cookie present and matching `GET /api/auth/get-session` **200** with exact synthetic `user.id`, `user.email`, and `session.userId`.
   - With the authenticated cookie, a hostile `Origin` **403**, hostile Origin plus apparently trusted Referer **403**, and a mutation with no Origin or Referer **403**.
   - Health remains `bootstrap_pending` after all denied attempts.
   - First allowed same-origin claim returns **200** and JSON `{claimed:true,userId:syntheticUserId}`, replay returns **409**, post-claim health returns `ready`.
   - Only after a real owned Node server `close`, database cleanup and exact owned HOME deletion may the final qualified receipt be emitted. Existing disk admission and isolated child credential environment remain intact.

2. Added `scripts/bostan-private-windows-http-evidence.mjs`, a small copy-first adaptation of the existing Mac fail-closed evidence model. It requires **15 exact, ordered, unique** stage events, complete HTTP journey, clean child-close without spawn failure or forced kill, successful DB and test HOME cleanup, and no preceding failure. It refuses malformed/oversized/**sparse** event arrays, duplicates, missing/out-of-order stages, and unverified teardown. The safe receipt does **not** echo event payloads, paths or credentials and always says `noOrphanPostgresProcessVerified:false` and `releaseQualified:false`.
3. Expanded source-level runner assertions in `scripts/bostan-private-windows-live-http.test.mjs` to pin actual identity, anonymous, CSRF, replay and all 15 event checks; full original runner tests against the complete source tree remain to run natively.

## Verified local evidence, not native qualification

Isolated Linux **Node 22.16.0**:

| Source | Exact GitHub blob SHA |
|---|---|
| New Windows evidence evaluator | `38625757ceebd1eb2c0eb7945ed92b93aafae6fe` |
| Its exact Node built-in tests | `8280715719c6e67bcf7f70a0ab92a27fe88327b9` |
| Updated Windows native HTTP runner | `d22dc7e6d030697e88d520a5daf83b5a85728a4d` |
| Expanded source-level runner tests | `0617bc5610e1fcbaedc5f53b641b7504ff0c8447` |

The first two files were reconstructed byte-for-byte, their Git hashes matched the GitHub refs, and real `node --test` passed **8/8 tests, 0 failed, 0 skipped**, including missing each one of 15 stages, duplicate/reorder attacks, all teardown gates, malformed input and sparse JavaScript arrays. The exact Windows parent passed isolated JavaScript syntax checking. Direct source inspection verified each of the 15 stage markers appears **once and in correct order**, qualification is gated on the strict evaluator, and the final proof runs **after** owned HOME cleanup. This source/static check is NOT a real Windows application server, database, HTTP or Playwright execution.

## Open acceptance gates

- Native Windows exact-head retake still blocked until B0-91 resource admission passes (last C: ~0.323 GiB versus minimum 2 GiB) and legitimate authorized computer access is restored (Desktop Commander monthly quota exhausted; do not retry/reconnect to evade it). Then run complete branch and Node24-based actual synthetic-only source PostgreSQL+HTTP suite and check the 15 stages, identity and 401/403/409 responses.
- Native Windows parent/child process `close` is not sufficient to prove all PostgreSQL `io_worker` descendants exited. Issue #234 requires independent zero-owned-orphan check with verified PID and executable path. This proof always marks orphan verification false.
- Windows startup Issue #237 and independent Mac latest-branch 16-stage native smoke, Windows/Mac Playwright/Chromium, zero-cost first real agent, compiled build/installers and final licensing/security remain unqualified.
- No destructive cleanup of unknown user files or unrelated PostgreSQL processes. Bostan stays PRIVATE, all PRs Draft, no protected main merge or publication.

**Release NO-GO.**
