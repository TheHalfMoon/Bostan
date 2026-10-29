# B1-29 — Fresh compiled runtime marker failure isolation

## Scope and exact parent

- Repository: private `TheHalfMoon/Bostan`; GitHub Actions remain disabled by project policy.
- Exact parent: B1-28 Draft PR #281, `3638f1d790b5da64c5f35ea2a7943ce587d85009`.
- Change: `server/scripts/bundle-runtime-commit.mjs` and a dedicated first-install regression suite.
- No protected-main change, PR merge, release, publish, deploy, npm pack, paid model/cloud, or customer data.

## Source-backed defect

In B1-28, a first build with no existing output directory promoted a complete staged bundle to the canonical `runtime` path. If `recordRuntimeOutputOwnership` then failed (for example, marker disk-write failure), the error path only isolated failed output when `oldMoved` was true. For a first build, `oldMoved` was false, so an **unowned** runtime remained at the canonical location and could block the next admission-controlled build.

An exact B1-28 Git blob `bc271144d5d1319c683ebf2aae7e59f538469980` was reproduced in an isolated local Linux Node 22.16.0 fixture. The new regression returned **1 PASS / 1 FAIL**, with the expected failure being the stranded canonical output.

## Change

On a failed marker write after promotion **without an old runtime**, move the canonical directory to a randomized sibling `-rejected-` location only if `stageIsExactlyOurs` proves it is a normal directory containing precisely the generated file names and SHA-256 bytes. Preserve any foreign, modified, linked, or unexpected contents in place. If the move fails, retain the original marker error and leave the uncertain directory untouched. Do not recursively delete the rejected copy.

This makes a clean first-install marker failure retryable without touching unrelated files. The existing old-runtime rollback logic remains unchanged.

## Executed tests

- Environment: isolated local Linux, Node 22.16.0; **below** Bostan's full Node >=24.11 engine requirement.
- Red (exact B1-28 source): **1 PASS / 1 FAIL** across two new regression cases; failure was expected.
- Green: `node --test bundle-runtime-commit.test.mjs bundle-runtime-staged-rollback.test.mjs bundle-runtime-first-install.test.mjs` **15/15 PASS**, zero failed/skipped (5 inherited B1-27, 8 inherited B1-28, 2 new).
- `node --check` source and new test: PASS.
- Parent inherited test blobs matched GitHub: `17eed900b823793545176ed0ceb2a1cafd800827` and `16a71f715950300117c571e45337b669fe0120cc`.
- Updated source Git blob: `6093ab4de3fb55537bbaf20a8115660f4b60b650`; new regression blob: `e066468ff67bb4a57f83881bf5b73b8827ca4c1b`.
- Tests use unique owned temporary fixtures and remove only their own directories. No remote operator processes or files were touched.

## Explicitly unqualified

Both Desktop Commander devices were offline at this run; no native Windows or Mac tests, pinned esbuild integration, full compiled Bostan server build, authenticated 18-stage localhost PG/HTTP, Chromium, actual zero-cost agent, installer, security/privacy/license or backup/recovery qualification. No proof of hostile filesystem TOCTOU or crash-atomic exchange. If a marker failure leaves extra files, the canonical output is deliberately preserved and may require manual recovery. The rejected sibling consumes disk until verified and handled.

Issues #234 (multi-suite PG orphan) and #237 (real Windows auth/HTTP/Chromium) remain open. Release **NO-GO**.

## Governance observation

The live GitHub `branches/main` API reported `protected:false` on 2026-10-29 even though main is operationally treated as protected. No repository settings were changed; a separate protection/ruleset review is warranted when supported.
