# B1-161 — Windows compiled runtime offline build and TypeScript resource boundary

**Private Draft / unmerged / release NO-GO — 2026-11-01 Asia/Riyadh.**

Direct parent is PR #417 at SHA b3ba435211862ce9d21c53600f3c905de9a859ba. Native authorized Windows 11 QA machine: Node24.19, pnpm9.12, TypeScript7.0.2. Used existing clean full private B111 QA checkout, original detached SHA 4a367c57e4a40c06dad2befd7de5a6ff43bd6081; temporarily fetched and checked out exactly parent SHA. The repo remained private; no production data, deployment, Actions, paid provider or new clone.

## Attempt 1: actual server build — NOT QUALIFIED

The checkout had no server/dist/index.js, no server/dist-runtime/index.mjs, no ui/dist/index.html. Existing prebuilt Runner JavaScript files were present, but the SHA-bearing Runner build stamp was missing; never invent such stamps.

Started from the exact checked-out repo root with NODE_OPTIONS=--max-old-space-size=2048:

~~~powershell
pnpm --filter @bostan/server build
~~~

The actual server build invoked prepare:runner-vendor; checks for protocol manifest, ACPX profiles, capability inventory and protocol coverage passed. The mandatory Runner binary task invoked the Rust release build with Cargo --locked. Cargo attempted to update crates.io index and downloaded several crates. Rather than allow unbounded network downloads or local cache growth, terminated ONLY this owned build terminal session (PID 7240; exit 1). Result: Runner build NOT qualified, server build NOT qualified, no server/dist/index.js produced. There was actual outbound registry activity before stopping; do not claim fully offline. Never remove shared global Cargo caches or spoof a Runner digest/stamp.

Future compiled acceptance should use a deliberately isolated, pinned offline Cargo cache with CARGO_NET_OFFLINE=true and --locked, refuse missing dependencies, preserve real Runner build digest and verify adequate disk/CPU/memory first.

## Attempt 2: diagnostic native TypeScript 7 server checker — NOT QUALIFIED

From same exact source SHA, ran the direct compiler (this does not replace the full server build):

~~~powershell
$env:NODE_OPTIONS='--max-old-space-size=2304'
server/node_modules/.bin/tsc.cmd --noEmit -p server/tsconfig.json
~~~

System free RAM fell from ~5.77 GiB to ~1.23 GiB without any final diagnostics. To protect the user workstation stopped ONLY the owned compiler terminal session (PID 18056; exit 1, no pass/fail count). RAM recovered to ~6.25 GiB. No TypeScript server pass or source defect is claimed.

## Attempt 3: exact compiled-mode admission — EXPECTED REFUSAL PASS

With session-local owned TEMP and source SHA verified, ran:

~~~powershell
node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-live-http.mjs --run-compiled
~~~

Observed exact diagnostic BOSTAN_WINDOWS_LIVE_COMPILED_RUNTIME_REFUSED, **EXIT 2**, **0 postgres.exe processes**, and no new runtime output. This proves that the QA runner fails closed when the owned SHA-verified compiled runtime is missing; it never substitutes source mode. It is NOT a successful compiled server test.

## Owned state and process hygiene

After the test, restored the original B111 QA checkout to detached SHA 4a367c57e4a40c06dad2befd7de5a6ff43bd6081 and confirmed CLEAN Git status; no server/dist/index.js or dist-runtime/index.mjs, no Bostan Cargo/Rust or PostgreSQL process left from these attempts.

Two other Cargo PIDs were read-only investigated and traced to a different concurrently active MedOrigin repository. These foreign processes were NOT terminated or modified. No unowned cleanup was done.

## Qualification boundary / future priorities

Parent PR #417 already has successful real Windows SOURCE-mode local authenticated HTTP+BetterAuth+temporary migrated PostgreSQL first-admin and graceful owned no-orphan cleanup. Do NOT lose that genuine PASS; this new checkpoint establishes why full COMPILED qualification remains blocked.

Still open and release-blocking: compiled SHA-verified runtime + Chromium/browser/roles (#237); repeated multi-suite forced-crash owned PostgreSQL io_worker teardown (#234); full Node24 TS7 server/root and Vitest; unprivileged Linux bwrap; installed three-OS user journeys, permission/side-effect consent, tenant isolation and third-party LICENSE/NOTICE/provenance review.

**RELEASE NO-GO. PRIVATE DRAFT ONLY. No merge, deployment, publication, Actions, paid services or customer data.**
