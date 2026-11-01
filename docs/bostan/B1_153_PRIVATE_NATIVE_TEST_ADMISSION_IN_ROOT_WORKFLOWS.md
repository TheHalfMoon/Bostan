# B1-153 — Require private source admission regressions before all root test modes

Status: **PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO**.
Direct parent: Draft PR #409, exact commit `664566760709785dd9e34ad63e337addb3069c42`. Only normal root package test wiring and a self-regression test are changed; no production HTTP code, dependencies, publish scripts, CI Actions, databases or external systems are changed.

## Actual defect

The repo already had three standalone dependency-free Node tests (private preflight, docs entry safety, UI brand gate), but normal root `test:run`, `test:run:general` and `test:run:serialized` only executed the static combined preflight, package-link checks and Vitest. The **test suites for that preflight and its source auditors did not run** in normal test workflows. In particular, if an audit implementation regressed in a way that still returned a false-green result, a normal root test run had no guaranteed coverage of its authored negative fixtures. This is a test-admission gap, not evidence of any actual published vulnerability.

## Repair

- New explicit `test:bostan-admission` runs the built-in Node test runner for four explicit files (new workflow contract, combined preflight, documentation gate, UI gate) with no wildcard, network or third-party process.
- Root `test:run`, `test:run:general` and `test:run:serialized` run `node scripts/bostan-private-preflight.mjs && pnpm run test:bostan-admission &&` **before** their original package-link and Vitest commands. The default `pnpm test` delegates to `test:run`.
- The new 7-case built-in Node regression checks the private root identity, release disablement, exact admission file list, every test mode's order, default delegation, and WebSocket qualification opt-in.
- Add `test:bostan-upgrade-wire` as an explicit command using `node --experimental-strip-types --test scripts/bostan-private-upgrade-wire.test.mjs`; it is **not silently elevated to the default green test suite** until the full exact source-native tests have passed on the repository's Node >=24.11 policy.

## Evidence and limits

Actually executed **7/7 PASS, zero failed/skipped**, native Node v22.16.0 built-in `node --test`, on the byte-identical newly authored test module in an owned ephemeral Linux sandbox with a **minimal synthetic package.json** containing the exact intended root script values. The exact GitHub root JSON was independently fetched before changing and validated through `JSON.parse`. The ephemeral test workspace was removed on exit. This proves the script-contract tests and desired wiring semantics in isolation, **not full product QA**.

**NOT RUN:** the whole private repository's combined Node admission suite (the other 3 source tests), exact new native 29-case WebSocket wire suite, full source Vitest5/TypeScript7, genuine rootless bwrap, installed Windows/macOS/Linux app journeys, repeated forced-crash native Windows PostgreSQL no-orphan #234, actual compiled Windows authenticated HTTP/BetterAuth/Chromium #237, agent consent/tenant privacy and legally required attribution/NOTICE verification. Linux Node22 remains below the repository minimum Node24.11. No release claim or main-branch merge is authorized by this evidence.

## Next required verification

On an authorized disposable full private worktree with pinned dependencies and Node >=24.11:

```sh
node scripts/bostan-private-preflight.mjs
pnpm run test:bostan-admission
pnpm run test:bostan-upgrade-wire
pnpm run test:run
```

Stop and diagnose any first failure rather than bypassing checks. Document real stdout/stderr counts and source SHA, run strict TS7 and genuine Linux sandbox admission, then pursue native Windows database and HTTP blockers.

Private Draft only. No release, GitHub Actions, publishing, paid services, customer data or foreign-process cleanup.
