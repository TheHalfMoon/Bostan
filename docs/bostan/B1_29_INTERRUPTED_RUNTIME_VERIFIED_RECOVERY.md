# B1-29 — Recover one verified runtime backup after interrupted promotion

Date: 2026-10-29. PRIVATE, nonpublishing Bostan. Exact stacked parent B1-28 Draft PR #281 head `3638f1d790b5da64c5f35ea2a7943ce587d85009`.

## Defect and boundary

B1-28 built new compiled runtime output in a private same-volume stage and attempted rollback if normal errors occurred. However a process crash or loss of power **after** `rename(runtime, rollback-UUID)` but **before** `rename(stage, runtime)` left the last valid runtime absent, even though the preceding complete, ownership-marked bundle remained in an adjacent rollback folder. The next `bundleRuntime` call previously did not restore that known-good runtime.

## Change

Add `server/scripts/bundle-runtime-recovery.mjs` and invoke `recoverInterruptedRuntime` **before** starting a new `buildAndCommitCompiledRuntime`. Recovery is limited to the exact target admitted by the existing path/source/ancestor safety checker. It activates only when the target directory is **absent**, and when there is **exactly one** sibling rollback folder matching Bostan's exact `.bostan-<runtime-name>-rollback-<UUID>` convention. The candidate must be a normal directory, not a symlink/junction, and contain only the expected original `.bostan-compiled-runtime-owner.json` plus flat generated `.mjs/.css/.map` files.

The marker must match the exact original source entry and original target outdir. All generated names are unique, required `index.mjs` and `server.mjs` are present, marker size and file count are bounded, each item is a regular non-linked file, and every SHA-256 digest is recomputed from bytes. After a second destination admission and absent-target check, recovery **renames** the single validated backup into the original path. It never overwrites an existing runtime, deletes backup contents, invents a marker, deletes unverified files, chooses arbitrarily among multiple candidates, or silently migrates legacy/foreign folders.

The next compile still runs as originally requested. A subsequent compilation failure leaves the verified recovered runtime intact under B1-27's existing `write:false` rule. This helper is not a general-purpose arbitrary filesystem recovery mechanism.

## Executed evidence

Local isolated Linux **Node 22.16.0**: `node --check` passed and `node --test --test-reporter=tap server/scripts/bundle-runtime-recovery.test.mjs` returned **11/11 PASS, zero failures/skips**. Synthetic disposable system-TEMP fixtures verify:

- one matching, complete rollback is restored; repeat recovery returns present;
- no candidate returns none, and an existing destination is never overwritten;
- multiple or malformed rollback candidates fail closed;
- an extra foreign file, modified compiled file, or source-mismatched marker is rejected without deletion;
- symlinked backup root or linked bundle file is rejected;
- injected rename refusal preserves the backup;
- a target appearing during final admission is left untouched, with old rollback preserved.

Exact byte identities confirmed after GitHub writes: locally executed helper Git blob `3a74e9bc8b605f8336a2bc2e1dda5f13f460fa5c`, locally executed test blob `283f54483efbe0cfe224105b4c237248c48071cf`. Integration change adds a pre-build call in `server/scripts/bundle-runtime-commit.mjs`. No real native Windows run occurred: authorized Windows Abdulaziz and Mac were both OFFLINE when checked.

## Remaining NO-GO

Not a fully atomic or concurrency-safe directory exchange: simultaneous builders and hostile filesystem TOCTOU are not qualified, and a power failure during the recovery rename itself remains dependent on OS filesystem guarantees. Existing runtime present but broken is intentionally **not** overwritten. The logic only operates when a **new compiled build is initiated**; a user launching a missing `dist-runtime/index.mjs` directly cannot invoke recovery itself.

No real pinned Windows esbuild/full server startup or localhost 18-stage authenticated PG/HTTP, Chromium, multi-suite PG orphan proof (#234), local agent, macOS E2E or installer qualification this wave. Issue #237 remains OPEN. Release **NO-GO**. Do not merge to main, publish, deploy, enable Actions, package, use paid services, or process real customer data; preserve Bostan identity and license/NOTICE.
