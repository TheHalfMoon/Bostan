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

## Remaining release NO-GO gates

- Re-run combined docs/UI admission on a **fully materialized authorized private checkout**; validate exact 58 cases with zero failures, then full root Vitest and TypeScript7.
- Genuine unprivileged Linux `bwrap` isolation; repeat/stress/forced-crash native PostgreSQL on Windows and verify all owned worker processes exit after teardown (#234).
- Fully booted compiled Windows authenticated HTTP/BetterAuth and browser/Chromium #237; installed Windows/macOS/Linux app journeys.
- Agent permission/side-effect consent, workspace/tenant isolation, LICENSE/NOTICE/provenance review.

**Do not merge, publish, release, deploy, enable Actions, claim full product qualification or clean up unrelated processes/files.** This is auditable engineering evidence only.
