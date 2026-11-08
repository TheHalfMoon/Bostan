# B1-171 — Fail-closed compiled build symlink-parent and stamp admission

**2026-11-01 Asia/Riyadh. PRIVATE DRAFT / UNMERGED / ZERO COST / RELEASE NO-GO.**

## Parent and scope

Direct parent: private open Draft PR #427, branch `work/b1-170-compiled-stamp-refuse-dirty-checkout`, exact parent HEAD `a105186f451030381639144ced3ce75ebabf0ee6`. This change is stacked **after** #427 and retains its clean-Git source admission. No main merge, Actions, release, deploy, cloud, paid provider, or customer data.

## Source security finding

The B1-169 compiled SHA-256 checks used `lstatSync` on the final `index.js` entries, but did not reject symbolic links in **intermediate directories**. A linked `server/dist/vendor/paperclip-runner` could redirect an otherwise regular, hash-matching `index.js` outside the owned compiled tree. Because generated `server/dist` is gitignored, #427's clean-Git check alone cannot detect this. Separately, the production `write-build-stamp.mjs` used `writeFileSync` on `server/dist/build-info.json` and could overwrite a pre-existing symlink target outside dist.

This is a bounded local artifact-ownership issue. No remote attack, real compiled Windows server, or browser exploit was claimed.

## Corrective changes

- The production build writer now requires actual nonlinked directories at `dist`, `dist/vendor`, and `dist/vendor/paperclip-runner` before hashing entries.
- The writer refuses an existing linked or hardlinked build stamp. It opens the stamp descriptor without truncation, verifies the descriptor and path are the same regular single-link inode, then truncates and writes through the verified descriptor. On supported POSIX platforms `O_NOFOLLOW` adds a final-component no-follow guard.
- The private compiled QA verifier independently rejects linked intermediate directories from the repository root through the runner directory **before** reading build stamp or compiled entry bytes. The existing Git clean-status, exact HEAD, executable digests, file bounds and pre-Postgres refusal remain.
- Two existing test files now reproduce the linked intermediate directory and linked build-stamp overwrite cases using **only synthetic owned disposable fixtures**. The writer test verifies the outside sentinel remains unchanged.

## Actual native qualification

On authorized macOS Apple Silicon, Node v26.0.0 and Vitest v5.0.3, in the existing full B142 private QA checkout:

- **RED before source fix**, test-only candidate `c96e294f57102af847478ae8dac783c306275ada` based on #426: built-in Node suite **5/6 PASS, 1 FAIL** (linked runner directory falsely admitted), writer Vitest **5/6 PASS, 1 FAIL** (linked stamp unexpectedly overwritten). Both process exit 1. This was before #427's concurrent clean-Git change.
- After rebasing source and tests onto #427, the initial synthetic test fixture required an ignored external-runner directory to satisfy #427's independently added clean-Git gate; that fixture-only issue was corrected. No production bypass of clean-Git checks.
- **GREEN final exact source/test commit `82a96372536bd02070adfdb3799ed2127dc89cb2`**: `node --test scripts/bostan-private-local-compiled-stamp.test.mjs scripts/bostan-local-http-postgres-smoke.test.mjs` **9/9 PASS, 0 fail/skip, exit 0**; from `server`, `NODE_OPTIONS=--max-old-space-size=1152 ./node_modules/.bin/vitest run src/__tests__/write-build-stamp.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1` **6/6 PASS, 0 fail/skip, exit 0**. Aggregate 15 test executions green, not a full repository suite.
- Mac B142 restored to original detached `88e0274412c2e6cbadd07534960b20184907f291`, Git clean (0 status entries), 0 matching owned QA processes. No PostgreSQL started, no full build, no extra clones or dependencies installed.

## Remaining release blockers

**NO-GO.** Fresh SHA-owned compiled server and actual Chromium role/tenant journeys (#237), real Windows PostgreSQL forced-crash `io_worker` zero-orphan stress (#234), root/server TypeScript and full Vitest, genuine unprivileged Linux bubblewrap, installed Windows/macOS/Linux journeys, governed side effects/consent, tenant isolation and required legal provenance remain unqualified. This guard does not authenticate malicious restamping or all transitively imported compiled files. Windows behavior of `O_NOFOLLOW` has not been independently qualified in this change.
