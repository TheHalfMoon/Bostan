# B1-168 — Refuse stale compiled Bostan source build before local PostgreSQL QA

**2026-11-01, Asia/Riyadh | PRIVATE / ZERO-COST / DRAFT / UNMERGED / RELEASE NO-GO**

Direct parent private Draft PR #424 SHA `5a995f3295c6be64bde708b92e15c7b4364f53c0`. Fully tested proposed source SHA `b4c2011938ccf02a0d73aa657db29b5a5e960d5c` on authorized clean macOS QA worktree. No publishing, deployment, paid model, production database or customer data.

## Genuine missing proof

The local compiled HTTP smoke runner `scripts/bostan-local-http-postgres-smoke.sh` previously admitted `--run-dist`, `--run-dist-authz`, `--run-packed-authz`, `--run-packed-authz-concurrent`, and `--run-packed-authz-ui` when compiled output files were present. Packed modes also verify SHA-256 hashes and exact ownership of `server/dist-runtime` files. **Neither check proved that the compiled output belonged to the Git commit currently being qualified.** A successful stale artifact run could thus be mistaken for an exact-current-source compile acceptance.

A real existing, previously prepared Mac QA checkout demonstrated this divergence: its Git source HEAD was `88e0274412c2e6cbadd07534960b20184907f291` with clean state, while the actual `server/dist/build-info.json` identified build commit `87e4713b2aa609045a7c912d31f5dc53ba6e1d9a`. The packed runtime had its SHA256 file-ownership marker and files, but the built server was stale relative to the checkout. The SHA ownership verifier is intentionally unchanged; this is a second distinct source-provenance gate.

## Strict offline gate

Added `scripts/bostan-private-local-compiled-stamp.mjs`, pure `matchesLocalCompiledSourceCommit()` checks and `--check` CLI. Reads a bounded (1..256 bytes), ordinary, nonlinked `server/dist/build-info.json`; requires a single JSON `commit` property containing exactly 40 lowercase hexadecimal digits. Runs a bounded local, read-only `git -C <repo> rev-parse HEAD` and requires equality. Refuses missing build-info, extra fields, abbreviated or nonhex values, wrong SHA, unexpected args or inaccessible Git with fixed **`BOSTAN_LOCAL_COMPILED_SOURCE_COMMIT_REFUSED` and exit 2**, without disclosing build paths or private data. A match produces `BOSTAN_LOCAL_COMPILED_SOURCE_COMMIT_VERIFIED`. No downloads, dependencies, cloud/provider calls or writes.

Inserted this gate after checking compiled file prerequisites and **before packed runtime validation, temporary database directory creation, `initdb`, migration or starting the server** for all five local compiled/packed smoke modes. Source-only and separate staged-deployed smoke modes are intentionally unchanged. The gate fails closed without silently using TypeScript source fallback.

## Actual native Mac execution against exact Git source

Authorized Apple Silicon Mac, Node v26.0.0; existing clean `Bostan-B142-qa` full QA checkout with already installed dependencies. Original detached HEAD `88e0274412c2e6cbadd07534960b20184907f291`. Temporarily fetched and checked out **exact proposed source SHA `b4c2011938ccf02a0d73aa657db29b5a5e960d5c`**, no clone/install.

~~~sh
bash -n scripts/bostan-local-http-postgres-smoke.sh
node --test --test-reporter=tap \
  scripts/bostan-private-local-compiled-stamp.test.mjs \
  scripts/bostan-local-http-postgres-smoke.test.mjs
node scripts/bostan-private-local-compiled-stamp.mjs --check
env -i PATH="$PATH" HOME="$HOME" USER="$USER" LANG="${LANG:-en_US.UTF-8}" \
  TMPDIR="${TMPDIR:-/tmp}" \
  bash scripts/bostan-local-http-postgres-smoke.sh --run-packed-authz
~~~

Results:

- **Bash syntax PASS**, exit 0.
- **Node TAP 7/7 PASS, 0 failed/skipped, exit 0, 302.66ms**; covers pure exact-commit validator (accept and negative malformed/extraneous/oversized/wrong-SHA), CLI invalid args and fixed redacted refusal, private smoke opt-in, cloud isolation, static gate ordering before the DB scratch root.
- Native direct CLI against the locally **stale** compiled build: emitted `BOSTAN_LOCAL_COMPILED_SOURCE_COMMIT_REFUSED`, expected **exit 2**.
- Actual local packed `--run-packed-authz` entry with a scrubbed session environment: cloud isolation PASS/zero paid providers, then emitted the same source-commit refusal and **exit 2** before initdb. Independent read-only pre/post inspection of `/private/tmp` observed **0** matching `bostan-live-http.*` directories both before and after; Git worktree remained CLEAN.
- Finally restored Mac B142 checkout to exact original detached SHA `88e0274412c2e6cbadd07534960b20184907f291`, verified Git CLEAN. No PostgreSQL instance was started, no QA scratch directory created, no unrelated processes or files killed/removed.

## Honest scope

This is a **source/build provenance safety regression PASS**, not compiled server function PASS, nor real Chromium browser or PostgreSQL crash-stress qualification. A fresh exact-SHA compiled runtime still needs a genuinely successful build and private local signed-in HTTP/browser tests. Windows issue #237 compiled/Chromium and issue #234 native forced-crash `io_worker` remain OPEN; root TypeScript7/full Vitest, Linux rootless bwrap, installed 3-OS apps, consent, tenant isolation and LICENSE/NOTICE review remain NO-GO.

Keep private Draft only; no main merge, Actions, release, publication, paid services or real user data.