# B1-17 — Install managed-child IPC stop before cold module import

**Date:** 2026-10-29 UTC. **Repository:** PRIVATE \`TheHalfMoon/Bostan\`. **Parent:** Draft PR #269, exact head \`4a367c57e4a40c06dad2befd7de5a6ff43bd6081\`; parent #268 remains Draft. Protected main was read-only (\`6f6af14a4c9157152d35acd2dcde7ccd1ee9152a\`). No merge, Actions, publication, deployment, paid model or customer data.

## Real production lifecycle defect

The managed Windows backend entrypoint \`scripts/bostan-managed-server-child.mjs\` awaited \`import("../server/src/index.ts")\` **before** calling \`superviseManagedServer\`. Thus IPC stop/disconnect listeners and the B1-16 30-second stop watchdog did not exist during cold import. Actual Windows source startup in #269 spent the full 180-second health deadline at \`static_import_start\` (5,248 modules, no health response); a parent stopping during this period could not reliably cancel its child.

A genuine native Windows Node 24.19.0 separate-process regression with a disposable synthetic \`server/src/index.ts\` performing a 500ms top-level await reproduced the defect on the exact parent source blob \`d9f4526b7cd297906d674c812c30007255458b9d\`: IPC stop was sent after the module reported \`synthetic:import-started\`; **the child started the server and exited 0** rather than rejecting the canceled startup. Original two-test replay: **1 PASS, 1 FAIL, exit 1** (the normal-shutdown control passed). No database, network listener, customer data or credentials.

## Production fix

Move the dynamic server import **inside** the callback passed to \`superviseManagedServer\`, so stop/disconnect handlers and the 30-second watchdog are installed before cold import. Pass an internal read-only \`stopRequested\` closure to the callback. Check it both before and after import; if the parent requested stop, refuse to call \`startServer()\` and fail nonzero with the existing secret-redacted diagnostic. An import can have side effects, so canceled startup must **not** claim clean PostgreSQL shutdown; the parent still requires independently verified process and database recovery gates.

## Genuine executed tests

- Windows 11, device \`Abdulaziz\`, Node **v24.19.0**; isolated marker-owned \`D:\Bostan-B117-temp\` only. Preflight: ~3.05 GiB free RAM, C ~8.7 GiB free, D ~16.19 GiB free, CPU load 6%; no PG/server/Chromium started. Existing B111 checkout was read-only and clean.
- Parent exact blob red test: **1 PASS, 1 FAIL** (expected red); canceled startup falsely returned code 0.
- Fixed exact source blob \`6d1dbc6d733d0eb09eadbe532b422ab80f9f7a51\`; new regression blob \`d0ac64edb40823242351b4ea481541ad7e10ed89\`. Git hashes matched the bytes written to the owned Windows fixture.
- Native Windows \`node --test\` over three files: **16 PASS, 0 FAIL, 0 SKIP**, 2.35 seconds. Includes inherited B1-15 8 tests (blob \`bb6ee8bc9f3b745f289ac0266fef2105a9f20497\`), B1-16 6 tests (blob \`d42f97a9bb6a87d68399c978c5dc596d4124e61e\`), and 2 new real IPC subprocess tests: cancel during slow import exits 1 and never starts the server; ordinary import and graceful stop still exit 0.
- Native Windows \`node --check\` on fixed source and new test: PASS. Post-run read-only scan: **0 Node processes with the owned B117 fixture path**. Free RAM ~3.08 GiB; C/D free unchanged at reported precision.
- Independently on isolated Linux Node v22.16.0, the original source and regression first produced the expected red (exit 0 instead of 1); after repair the two new tests passed **2/2**.

## Explicitly not qualified

This wave did **not** start PostgreSQL, a real Bostan server, HTTP health, Better Auth, Chromium, or an AI agent. The real native Windows \`static_import_start\` and nested runner build's intermittent \`ERR_UNSUPPORTED_ESM_URL_SCHEME\` remain unresolved. No native Mac test; Mac was offline. The B1-16 30-second watchdog is still a timeout, not proof of clean DB teardown. Issues #234 (PostgreSQL worker ownership) and #237 (real Windows authenticated HTTP) remain OPEN. Full compiled build, 18-stage authenticated HTTP, Playwright, first zero-cost agent, installer, independent security/licensing/backup/recovery remain **NO-GO**. Preserve Bostan branding and legal NOTICE.

## Next engineering gate

Measure a compiled-server cold startup separately from TypeScript import profiling, diagnose the runner build's Windows sequence-specific drive-letter ESM import error with an exact trace, and retest full authenticated Windows HTTP only when resource admission and owned cleanup can be guaranteed. Keep every stacked PR Draft, never merge or publish.
