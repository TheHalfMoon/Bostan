# B1-157 — Native Windows Node 24 private WebSocket and PG synthetic qualification

**Status: PRIVATE / DRAFT / UNMERGED / RELEASE NO-GO.** Evidence date: 2026-11-01 Asia/Riyadh.

## Immutable source and environment

- Direct parent: B1-156 Draft PR #413, exact Git commit `78839ebeaeeef9a4239ed1b18593b899aa4a79fe`.
- Real authorized Windows device (Windows 11), Node **v24.19.0**, pnpm **9.12.0**, git **2.56.0.windows.4**, local **Vitest 5.0.3**.
- The existing *clean*, detached, GitHub-authenticated private scratch checkout `D:\Bostan-B177-qa` was temporarily moved from old SHA `e02229502d664a3594174886752e794a3a43edaf` to exact parent SHA via `git fetch --depth=1 --filter=blob:none` and `git checkout --detach` with hooks disabled.
- The test checkout already had a pinned dependency tree, but sparse-checkout included only `packages/db`; `git sparse-checkout add scripts server/src/middleware` materialized exactly the required source for WebSocket testing. Git working tree was verified **clean** at the exact HEAD.
- No GitHub Actions, release, deployment, paid provider, customer data or production database were used.

## Qualification 1 — exact checked-in WebSocket HTTP upgrade wire

Command run on the actual Windows checkout:

```powershell
node --experimental-strip-types --test scripts/bostan-private-upgrade-wire.test.mjs
```

**PASS 35/35; FAIL 0; SKIP 0; EXIT 0; approximately 550 ms.** This command imported the **exact checked-in** TypeScript production function from `server/src/middleware/private-hostname-guard.ts` under the supported Node 24.19 runtime and sent **real loopback TCP HTTP/1.1 requests** to a disposable native `node:http` server.

Coverage: canonical private and public Host/Origin compatibility, forged forwarded Host, duplicate Host/Origin, noncanonical Host, IPv6 wildcard binding, POST/body framing/duplicate Upgrade, lexical and duplicated Connection tokens (including NBSP vs ASCII tab), rejected HTTP/1.0 and HTTP/2.0 upgrade request lines, and public-mode compatibility.

**Scope:** source-native admission predicate and native parser; **not** authenticated production WebSocket listeners, BetterAuth, Chromium or packaged app.

## Qualification 2 — source-native Windows PostgreSQL stop policy with synthetic fixtures

Command executed **from the package directory** (root Vitest workspace config was unsuitable for a sparse checkout):

```powershell
cd packages/db
pnpm exec vitest run src/windows-embedded-postgres-stop.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1
```

**PASS 49; SKIP 6; FAIL 0; EXIT 0**, Vitest 5.0.3. The tests exercise the **exact source code** for bounded, identity-verified Windows test-fixture PostgreSQL teardown with **mocked process inspector and runner** and owned temporary marker files.

**This test did not start actual PostgreSQL, execute pg_ctl, perform multi-suite/native forced-crash stress, or prove zero native io_worker orphans after real embedded PG shutdown.** Issue #234 therefore **remains OPEN**. A read-only Windows CIM check observed **zero postgres.exe processes** before and after this synthetic run; this is not post-native-teardown proof.

## Incomplete qualification 3 — private docs/UI/workflow Node admission

Command run on the exact same sparse checkout:

```powershell
node --test scripts/bostan-private-workflow-admission.test.mjs scripts/bostan-private-preflight.test.mjs scripts/bostan-private-docs-entry-gate.test.mjs scripts/bostan-private-ui-brand-gate.test.mjs
```

**55 PASS; 3 FAIL; 0 SKIP; 58 TOTAL**. All three failures are directly attributable to **missing tracked files in the sparse checkout**:
1. `docs/docs.json` absent, preventing full docs checkout scan.
2. CLI combined preflight correctly refuses missing docs/UI.
3. `ui/src/pages/BoardChat.tsx` and UI brand assets absent, preventing UI checkout scan.

The assertion failures must **NOT** be called source regressions or a passed full Bostan admission suite. Source-negative fixtures and workflow contract regression cases passed; full checkout needs re-run. An attempt to expand sparse scope to `docs` and `ui` was denied by a tool safety check and **was not retried or bypassed**.

## Qualification 4 — exact full-checkout docs/UI workflow admission **PASS 58/58**

A second **previously existing, fully materialized, CLEAN** private Windows 11 checkout was found at `D:\Bostan-B111-qa`, original detached HEAD `4a367c57e4a40c06dad2befd7de5a6ff43bd6081`. The checkout already included `docs/docs.json`, the six required `ui` assets, scripts, dependencies, and the full Git tree. No blocked sparse scope expansion was retried.

Git fetched exactly the same private B1-156 commit `78839ebeaeeef9a4239ed1b18593b899aa4a79fe`, checked out detached with git hooks disabled, and verified the full checkout remained clean. On **Node v24.19.0 / Windows 11**, both commands ran against the actual checked-in files:

```powershell
node --test scripts/bostan-private-workflow-admission.test.mjs scripts/bostan-private-preflight.test.mjs scripts/bostan-private-docs-entry-gate.test.mjs scripts/bostan-private-ui-brand-gate.test.mjs
pnpm run test:bostan-admission
```

**Both commands PASS 58/58, FAIL 0, SKIP 0, EXIT 0**. Direct Node run completed in approximately **261 ms**, root pnpm command in approximately **275 ms** of Node test time. This verifies **actual** source-backed docs and UI navigation/status assets, independent negative fixtures, private combined preflight including CLI entry, and root script admission contract.

The earlier **55 PASS / 3 FAIL** on the *sparse* checkout above remains accurately recorded as an incomplete first attempt, **superseded for docs/UI admission qualification by this successful full-checkout result**. It does not imply full Vitest/TypeScript or installed app readiness.


## Qualification 5 — native Windows private Host security suite PASS 83/83

On the previous clean authorized full Windows 11 QA checkout (Node v24.19.0, Vitest v5.0.3), git HEAD was temporarily moved from 4a367c57e4a40c06dad2befd7de5a6ff43bd6081 to exact B1-157 head b662bfc7c629e19112fe1a700b0b119573383cba and verified CLEAN. The following package-local Vitest command ran with one worker to limit memory:

~~~powershell
cd server
pnpm exec vitest run src/__tests__/private-hostname-guard.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1
~~~

**Actual result: 83/83 PASS in 1 source-native file, 0 fail, EXIT 0, 14.25 seconds.** The exact checked-in TypeScript production Host/WebSocket admission module was exercised by real Vitest/Supertest code. This is NOT qualification of a fully booted authenticated application or browser.

### Bounded stop: authenticated route suites not qualified

A separate attempt to run three auth-route suites (auth-routes.test.ts, bootstrap-claim-routes.test.ts, auth-session-route.test.ts) using the same one-worker Vitest config began but never returned final test results. Read-only Windows memory observations showed free RAM fall from ~2.85 GiB to **0.58 GiB** while it remained active. To protect the user's workstation, only this owned test terminal session was forcibly terminated. The session exited 1 after approximately 61 seconds; **NO TEST PASS/FAIL COUNT** can honestly be reported. This does not establish a source defect or authenticated server readiness. No real PostgreSQL was started; read-only CIM confirmed zero postgres.exe processes. Free memory subsequently recovered to approximately 1.64 GiB. Windows full QA checkout was returned to its EXACT original detached HEAD and CLEAN status.

Future native auth-route/BetterAuth startup tests must first meet resource requirements (adequate free memory, single narrow suite or isolated disposable host). Do not disable safety checks or terminate unrelated applications.

## Qualification 6 — actual macOS source tests PASS 35/35 and 58/58

A previously existing, clean, FULL private Mac QA checkout (Bostan-B175-qa) on Darwin/macOS, Node v26.0.0, 8 GiB installed RAM, original detached HEAD 071e69fbd888cebd99960ca2f4a007e87b11ac6e, temporarily fetched and checked out exact B1-157 HEAD b662bfc7c629e19112fe1a700b0b119573383cba without local dependency installation, new clones, publication, external services, or customer data.

The following **exact checked-in** source tests ran directly on native macOS:

~~~sh
node --experimental-strip-types --test --test-reporter=tap scripts/bostan-private-upgrade-wire.test.mjs
node --test --test-reporter=tap scripts/bostan-private-workflow-admission.test.mjs scripts/bostan-private-preflight.test.mjs scripts/bostan-private-docs-entry-gate.test.mjs scripts/bostan-private-ui-brand-gate.test.mjs
~~~

**Mac TCP HTTP Upgrade WebSocket admission: 35/35 PASS, 0 fail/skip, EXIT 0, ~207 ms**, genuinely importing the private production TypeScript gate and using local native TCP sockets.

**Mac docs/UI/workflow admission: 58/58 PASS, 0 fail/skip, EXIT 0, ~170 ms**, using actual tracked docs/navigation/brand assets and negative-fixture source tests.

The existing Mac checkout was restored to its EXACT original detached HEAD 071e69fbd888cebd99960ca2f4a007e87b11ac6e and verified CLEAN. This cross-OS evidence is for source regression gates only, not a fully installed/packaged macOS Bostan GUI, authenticated backend, or consent/tenant runtime.

## Remaining release NO-GO gates

- Combined docs/UI admission: **now satisfied for this exact B1-156 source SHA on native Windows Node24**. Still requires full root Vitest/TypeScript7 and a release-frozen cross-OS qualification.
- Genuine unprivileged Linux `bwrap` isolation; repeat/stress/forced-crash native PostgreSQL on Windows and verify all owned worker processes exit after teardown (#234).
- Fully booted compiled Windows authenticated HTTP/BetterAuth and browser/Chromium #237; installed Windows/macOS/Linux app journeys.
- Agent permission/side-effect consent, workspace/tenant isolation, LICENSE/NOTICE/provenance review.

**Do not merge, publish, release, deploy, enable Actions, claim full product qualification or clean up unrelated processes/files.** This is auditable engineering evidence only.
