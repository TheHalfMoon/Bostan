# B1-32 — Real cross-process compiled runtime build lock proof

Date: 2026-10-29. Repository `TheHalfMoon/Bostan` remains **PRIVATE** and strictly **NONPUBLISHING**. Exact stacked parent B1-31 Draft PR #284 at `2c531e4b509e3fc759c870cfee9e8df6f7780caa`. No main merge, publication, deployment or release.

## Qualification gap

B1-31 introduced `withExclusiveRuntimeBuildLock`, but its regression tests ran concurrent callbacks **inside one Node process**. The implementation claims to protect multiple independent builders through the filesystem's exclusive create semantics, and a stopped owner must not trigger automatic lock theft. These properties require child-process evidence, not merely asynchronous function calls sharing one event loop.

## Actual executable evidence

New `server/scripts/bundle-runtime-lock-cross-process.test.mjs` creates its own isolated `os.tmpdir()` fixture and uses two **independently spawned Node.js processes**:

1. An owned child acquires `.bostan-runtime-build.lock` through the real committed production helper, and signals its parent via IPC once inside the protected operation. A second, independent Node contender then calls the same production helper for the same output. It fails before invoking its operation callback, returning the expected safe lock error without changing the first owner's token. The harness then **terminates only its own spawned child**, observes its exit, verifies the stale lock remains unchanged, and checks that a third independent contender still cannot seize it. This does not kill or inspect unrelated processes.
2. While the first child holds `runtime`, another Node process successfully acquires and releases a separate `dist-runtime` lock. The first lock and token remain unchanged.

The test cleans up only its own temporary fixture and installs a child-process teardown to avoid leaving an owned process. Spawn failure and handshake timeout fail the test rather than being treated as success. The child run is in a real OS process; no pretend timing or mocked exclusive-create behavior.

Executed on the isolated local Linux Node.js **v22.16.0** using exact B1-31 production helper blob `478ae93f990ecd963ca7b18ae2da1a2bda97380d`:
- New independent-process suite **2/2 PASS**, zero fail or skip.
- Combined with existing local B1-27/B1-28/B1-30/B1-31 suites: **36/36 PASS, zero failures/skips**; `node --check` PASS.
- `git hash-object` for the new locally executed test: `0786807d464811235a8b0fb1cf5f1cf738062040`; GitHub returned the **same exact blob** after creation. No production source file was modified by this PR.

## NO-GO / remaining proof

This adds real **Linux process isolation** evidence only. It does not prove Windows NTFS exclusive-create behavior, Windows junction/rename safety, malicious filesystem TOCTOU resistance, robust automatic recovery from a stale lock, shared/network storage semantics or real esbuild compilation. The existing policy deliberately refuses stale-lock theft and may block future builds until safely reviewed.

Both authorized remote Windows and Mac devices were OFFLINE in the preflight. Full compiled Bostan app, real authenticated 18-stage PG/HTTP (#237), multi-suite PostgreSQL orphan proof (#234), Chromium, first free offline agent, installers, Mac and licensing/privacy end-to-end still need actual executed results. No real customer data or paid compute/models used. Keep GitHub Actions OFF, repo PRIVATE, Draft only, no protected-main merge/publish/deploy/release/npm pack. Product release **NO-GO**.
