# B1-169 — Bind the compiled Bostan QA build stamp to exact executable bytes

**2026-11-01, Asia/Riyadh | PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO**

Direct parent: private stacked PR #425 HEAD `e8d8aefffc3136261982f951bada52c9dc19e6e2`. Exact **source and tests qualified** at `09b0b17d25cd8fa7a6b131797ab578ff5240ae18`. No production deployment, public release, GitHub Actions, paid provider, user data or new clone.

## Root cause and scope

PR #425 introduced a useful fail-closed compiled-source admission, but the existing production `server/scripts/write-build-stamp.mjs` emitted a `{commit}` string **without a digest of the compiled server or vendored Runner**. A generated executable could be substituted after stamping without changing the commit string. Existing `dist-runtime` SHA-256 ownership does not guard `server/dist/index.js` nor its vendored Runner independently.

The production server build already executes `write-build-stamp.mjs` **after** TypeScript compilation, Runner vendor preparation and built asset copies. B1-169 now computes SHA-256 of both existing regular nonlinked built entries in the build stamp writer:

- `server/dist/index.js` => `indexSha256`
- `server/dist/vendor/paperclip-runner/index.js` => `vendorSha256`

The new three-field JSON stamp keeps the 40-digit commit value for existing telemetry readers. A missing, empty, substituted symlink or unexpectedly large compiled entry refuses stamping rather than writing an unbound provenance record. The private, test-only local compiled admission now independently reads and hashes **both** files (up to 128MiB per entry), requires exact SHA-256 equality in addition to Git HEAD equality, and keeps the stamp strictly capped at 256 bytes. Every local compiled/packed HTTP smoke mode still invokes admission **before** disposable PostgreSQL fixture creation.

This is **post-build executable integrity binding**; it is not proof of a reproducible build or a defense against a fully malicious actor simultaneously regenerating both executable files and stamps. A new genuine full build at the exact source commit is still needed for runtime qualification.

## Exact native Mac source tests (ACTUAL)

Authorized existing, full macOS B142 private QA checkout, Apple Silicon/Node **v26.0.0**, already installed pinned dependencies. Original detached SHA `88e0274412c2e6cbadd07534960b20184907f291`; temporarily fetched and checked out exact new code/test commit `09b0b17d25cd8fa7a6b131797ab578ff5240ae18`. No Rust build, package downloads, cloud or new repo clone.

~~~sh
node --test --test-reporter=tap scripts/bostan-private-local-compiled-stamp.test.mjs scripts/bostan-local-http-postgres-smoke.test.mjs
cd server && NODE_OPTIONS=--max-old-space-size=1152 ./node_modules/.bin/vitest run src/__tests__/write-build-stamp.test.ts --config vitest.config.ts --pool=forks --maxWorkers=1
~~~

**Aggregate exact-source result: 15/15 native tests PASS (Node 9/9 + Vitest 6/6), zero failed or skipped.** This is source/test and provenance admission qualification, not actual production compiled server startup.

- **Native Node TAP 9/9 PASS**, all exit0, final suite ~361ms. Covers exact three-field hash and source-commit validation; rejects malformed/oversized/wrong SHA values, mismatched executable/Runner digests, unknown flags, invalid cloud admission; checks that compiled QA blocks before database scratch creation.
- **Native Vitest write-build-stamp 6/6 PASS**, exit0, ~304ms final run. A real small isolated synthetic Git repo with exactly two synthetic compiled files was stamped through the actual `write-build-stamp.mjs`; tests verify the Git source SHA and both computed SHA-256s. Existing commit resolution tests passed unchanged.
- The new Node regression also creates a **real isolated temporary Git checkout** with two synthetic executable files and genuine `git rev-parse HEAD`. `checkLocalCompiledBuildStamp()` accepts matching bytes, refuses modified server bytes, refuses modified Runner bytes, reaccepts restored contents, and refuses a substituted commit. Only this test's fresh temporary root is cleaned up.
- Preliminary tests at earlier code SHA `455a0f9d...` were **RED 7/8** because an oversized test fixture was based on the previous stamp size limit. Three SHA-256 fields serialize to **230 bytes** in the production writer, so the 256-byte ceiling was preserved and the exact final source is **GREEN 9/9**. Do not report the preliminary RED run as a passing result.

## Actual packed-mode fail-closed pre-database check

On the exact new source SHA, a controlled `--run-packed-authz` invocation with an independently scrubbed private environment passed the no-cloud/local isolation guard and correctly emitted `BOSTAN_LOCAL_COMPILED_SOURCE_COMMIT_REFUSED` / **EXIT 2** against old existing `server/dist/build-info.json` (commit-only stale output). Independent read-only checks found **0** matching owned local HTTP PostgreSQL scratch directories before and after; no DB/HTTP process was started. Source Git remained CLEAN.

## Resource hygiene and release boundary

Observed Mac RAM fluctuating around 36–54% free; deliberately **did not** run a full TypeScript/Rust rebuild or launch historical real PostgreSQL+HTTP under limited memory. No compiled server/app startup, Chromium browser, Windows forced-crash PostgreSQL `io_worker` or installed OS acceptance is implied. After tests, restored Mac B142 EXACT original detached SHA `88e0274412c2e6cbadd07534960b20184907f291` with Git CLEAN and 0 private-QA-owned postgres processes. No unrelated user files/processes/caches changed.

**Release NO-GO remains:** issue #234 real native Windows repeated forced-crash/io_worker cleanup; #237 freshly SHA-owned compiled Windows server and real Chromium roles/tenant; full TS7/root Vitest, Linux unprivileged bwrap, installed Windows/macOS/Linux, side-effect consent, tenant privacy and third-party LICENSE/NOTICE/provenance acceptance. Keep PRIVATE DRAFT unmerged, no Actions, deployment, paid resources or customer data.