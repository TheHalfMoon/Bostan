# B1-236 — State of engineering (2026-11-08)

Private reconnaissance of `TheHalfMoon/Bostan`. Every number below was measured on 2026-11-08 against GitHub and a fresh clone of the stack tip. Release status: **NO-GO / publication hold**.

## 1. Repository shape

| Fact | Value |
|---|---|
| `main` | `6f6af14a` (2026-10-23), imported baseline plus three docs commits |
| Open PRs | 481: 458 B-series drafts plus 23 Dependabot bumps |
| Merged PRs | **0** |
| Stack | One linear chain from #15 (base `main`) up to #492, now #493 |
| Tip vs `main` | 1,255 commits ahead; 4,860 files; +72,233 / −14,489 |
| GitHub Actions | **Disabled** at repo level, so no PR has ever had a CI check |

Changed lines by area (path classification):

| Area | Share |
|---|---|
| `scripts/` (QA harness) | 29.5% |
| Docs | 26.1% |
| Product code (`server`, `ui`, `cli`, `packages`, non-test) | 25.4% |
| Tests and stories | 17.8% |

| Series | PRs | Focus |
|---|---|---|
| B0 | 123 | Rebrand, auth identity, telemetry gates, local PostgreSQL runtime, onboarding |
| B1 | 243 | QA and runtime hardening. Titles mention Windows/CIM 97 times and PostgreSQL 81 times |
| B2–B6 | 92 | Evidence, recommendations, gateway receipts, task docs, agent UI identity |

## 2. Findings

1. **Integration is the primary blocker, not features.** Nothing has reached `main` in 16 days. Each new PR adds one more layer to a chain of 465. No reviewer can qualify the exact commit being merged, and every stacked base must be rewritten if anything below it changes.
2. **No automated gate exists.** Actions is off, so "qualified" means hand-run receipts written in PR bodies. Issue #4 asks for a workflow review before Actions is enabled. The inherited `pr.yml` calls an upstream reusable workflow (`paperclipai/paperclip/...@master`), which must be replaced before Actions is turned on.
3. **Publishing workflows are present but inert.** `release.yml` (nightly cron), `docker.yml` and `storybook-deploy.yml` exist. They target `master` or a manual dispatch, and Actions is disabled. Keep it that way, or delete or neuter them, before enabling Actions.
4. **Fresh Windows install was broken.** Fixed in this PR (B1-236):
   - Root postinstall `symlinkSync(..., "dir")` threw EPERM. It now uses a junction.
   - The SDK dev link sat under the donor `@paperclipai` scope while plugins import `@bostan/plugin-sdk`, a missed rebrand migration.
5. **Typecheck at the tip was red.** TS2345 in `packages/adapter-utils/src/local-process-sandbox.ts`, fixed in this PR. No CI meant nobody noticed.
6. **Issues #430 and #431 are already fixed in the stack.**
   - #430: the supervisor now uses a shared `shutdownPromise`.
   - #431: POSIX `stopEmbeddedPostgresBounded` keeps the fixture after a rejected stop.
   - Close both once the stack lands.
7. **Donor names remain widely.** Files mentioning `paperclip`: `ui/src` 298, `server/src` 708, `cli/src` 72, `packages` 1,338. Many are technical identifiers (adapter type `paperclip_runner`, package dir `packages/paperclip-runner`, env keys). Issue #35 already separates copy from symbols. Visible copy still needs a route-by-route browser audit.

## 3. Windows verification run for this PR

Host: Windows 11 Home 10.0.26300, Node 24.19.0, pnpm 9.15.4.

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` at #492 | **FAIL**: EPERM in root postinstall |
| Same, with B1-236 | **PASS** (offline) |
| `node --test scripts/link-plugin-dev-sdk.test.js` | Fails against the old script; 10/10 pass with the fix |
| `pnpm -r typecheck` (parallel) | Out of memory on this host (about 3.5 GB free) |
| `pnpm -r --workspace-concurrency=1 --no-bail typecheck` | All packages pass except `server` and `ui` (out of memory on this host); see §3.1 |
| `@bostan/runner` `typecheck:rust` | Environment gap: `rustfmt` component not installed for toolchain 1.97.1-msvc |

### 3.1 Serial typecheck

After the `adapter-utils` fix, every workspace package typechecks with **0 TS errors**, with these exceptions:

- **`@bostan/server` and `@bostan/ui`:** not qualified. `tsc` (typescript-go 7.0.2) aborted with `runtime: cannot allocate memory` even with `--workspace-concurrency=1`, on a host with about 3.5 GB free RAM. This is an environment limit, not a source error. Rerun them on a host with ≥ 8 GB free, or in CI.
- **`@bostan/runner` Rust leg:** not run. The `rustfmt` component is not installed on this host. The TypeScript leg passed.

## 4. Recommended next steps (priority order)

1. **Collapse the stack into `main`.** Merge the tip as one integration change after a full local qualification on Windows, then close the superseded drafts with a pointer to the integration commit. From then on, branch every PR from `main`, keep it small, and merge each one before starting the next. This needs the owner's decision.
2. **Enable a minimal private CI.** Run `install`, `typecheck` and the unit tests on `pull_request` to `main`. Use Bostan-owned workflows only. Remove or disable `release.yml`, `docker.yml` and `storybook-deploy.yml`, and anything that calls upstream reusable workflows or publishes. This must be done before Actions is turned on.
3. **Real qualification on the integrated `main`:**
   - Windows embedded PostgreSQL boot and migration (#234).
   - Authenticated server plus Chromium (#237).
   - An agent and task journey.
   - Restart and recovery.
4. **User-visible Bostan identity audit**, done with browser screenshots per route (#35, #4).
5. Close stale issues #430 and #431.
