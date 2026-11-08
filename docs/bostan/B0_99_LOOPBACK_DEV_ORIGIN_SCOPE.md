# B0-99 — Scope automatic Vite development origins to loopback servers

Date: 2026-10-28. Bostan PRIVATE source engineering, stacked on B0-98 Draft PR #250. Never merge to `main`, enable GitHub Actions, release, deploy, publish, access customer data or use paid AI.

## Reproduced issue

`server/src/middleware/board-mutation-guard.ts` always included the development origins `http://localhost:3100` and `http://127.0.0.1:3100` in the browser-session mutation origin allowlist, regardless of whether the target Bostan server was loopback or a remotely hosted instance. Consequently an HTTPS request addressed to `private.example.invalid:42000` with `Origin: http://localhost:3100` was deemed trusted by the prior exact source. This is an **unnecessarily broad origin exception**; it is not by itself proof of an exploitable cross-site request forgery, which also depends on cookies, browser SameSite policy, deployment exposure and other controls.

## B0-99 change

- Add a narrowly scoped `isLoopbackRequestHost(host)` helper that parses the authority and recognizes only `localhost`, `127.0.0.1`, or `[::1]` as target loopback hosts.
- Built-in Vite development origins are added **only if the effective request Host is loopback**. `requestHost(req)` already considers a forwarded Host only when the immediate proxy is explicitly trusted. A localhost-facing reverse proxy forwarding a public Host cannot cause an automatic dev-origin exception.
- Keep Host-derived same-scheme origin trust from B0-98, canonical browser Origin validation from B0-97, and Origin/Referer precedence from B0-96.
- Leave explicit operator `PAPERCLIP_PUBLIC_URL` configuration as an independent allowed origin even for a remote Host. If a remote operator intentionally needs a separate development UI, they must configure that explicitly.
- Add four server Vitest/Supertest regressions: remote Host refuses built-in localhost Origin (**403**); real loopback Host retains the dev origin (**204**); a lookalike `localhost.attacker.example.invalid` Host does not inherit the exception (**403**); a trusted reverse proxy with a remote forwarded Host does not inherit the local proxy's exemption (**403**).

## Local execution evidence

The exact current GitHub TypeScript source was reconstructed byte-for-byte, with Git blob SHA **`63c02ab7a8f7adee2695de4fc2a7b8f9ec90aff2`**. Its TypeScript compilation to CommonJS for isolated local execution emitted **zero diagnostics**.

On Linux Node **22.16.0**, the current module was executed with synthetic Request/Response/Express proxy mocks; **18/18 PASS, 0 failures**, including five nonloopback/host-spoof examples, four loopback hosts (including IPv6), trusted/untrusted forwarded-Host, missing Host, Referer-only cases, operator-configured public URL, correct same-scheme and rejected cross-scheme origins. The before/after test executed B0-98's exact prior source and showed its broader dev-origin acceptance.

These are **direct source-mock tests**, not an operational browser/HTTP/PostgreSQL E2E. The new server Vitest/Supertest regressions were added but have **not yet been run against complete native project dependencies**.

## Release gates still open

- Native Mac exact-head full server tests, Playwright and real embedded PostgreSQL/HTTP authenticated first-admin retake (B0-98's 16 strict markers) are required. B0-93 previously passed a native manual Mac HTTP/signup/claim/shutdown sequence, but the newer guards have not received native retakes.
- Native Windows C: was last measured at about 0.323 GiB free (B0-91 requires 2 GiB minimum) so no heavy installs, PG/HTTP, Chromium or builds until disk admission passes. Never delete unrelated user files.
- Authorized Desktop Commander had hit its monthly usage quota on 2026-10-28; do not retry/reconnect to circumvent quota. Preserve and inspect only test-owned `/private/tmp/bostan-b093*` artifacts, after checking there are no still-running test processes, once authorized access returns.
- Real zero-cost local agent work, compiled app qualification, native installers and complete licensing/security gates remain pending.

**Bostan PRIVATE — stacked Draft — release NO-GO.**
