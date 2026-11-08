# B1-238 — Integration test inventory (PR #495)

This is the first complete CI run of the B0–B1 stack: run 42431421229 on head `29fdf1b6`, with 13 parallel lanes, on 2026-11-08. None of the 465 stacked PRs had ever run CI, so this inventory is the accumulated drift. Each item is classified, then marked fixed or open with the commit that fixed it.

Lanes that passed: `gates`, `typecheck` (all packages including `server`, `ui` and Rust `cargo fmt`/`check`), `windows` (install), and `workspaces-c` (`@bostan/db`).

## Totals per lane

| Lane | Failed test files | Failed tests | Passed tests |
|---|---|---|---|
| server-1 | 14 | 6 | 5,242 |
| server-2 | many | ~60 | (see log) |
| server-3 | 12 | 2 | 5,366 |
| server-4 | 6 | 4 | 4,249 |
| chat | 1 | 1 | 1,416 |
| workspaces-a | 14 | 54 | 9,152 |
| workspaces-b | 1 | 1 | 1,049 |
| serialized-1 | 3 | 2 | 1,636 |
| serialized-2 | 1 | 1 | 1,406 |

## A. CI or harness setup (not product)

| Item | Cause | Status |
|---|---|---|
| `@bostan/runner` cannot be resolved (about 12 files) | `server/vitest.config.ts` still aliased `@paperclipai/paperclip-runner`, a missed rebrand | **fixed** `f9dcffb3` |
| "No test suite found" for `server/scripts/*.test.mjs` (15 files) and `ui/scripts/*.test.mjs` (4 files) | `node:test` suites matched by the vitest include | **fixed** `f9dcffb3`, `79825887`. Now run with `node --test`; locally 62 pass/5 skip and 14 pass |
| Single job exceeded its 60 min timeout | Suite too large for one 2-core runner | **fixed** `29fdf1b6` (lanes) |
| `cargo fmt` diff in `process_supervisor.rs` | Never formatted | **fixed** `7eb6378f` |

## B. Tests left stale by stack changes

| Item | Cause | Status |
|---|---|---|
| `skills-catalog` `packaged-artifacts` | Release lockdown makes `prepack` fail; the test ran a real `npm pack` | **fixed** `33b81790` (`--dry-run --ignore-scripts`) |
| `invite-accept-*` (2) | The product now says "Bostan Runner" | **fixed** `72e50614` |
| `chat-channels` Slack replay | B3-05 replay now fails closed with a 409 | **fixed** `f4542d09` |
| `server-startup-feedback-export` (35) | Mock lacks the new `shouldEnablePrivateHostnameGuard` export | **fixed** `931f9c19` (Windows 39/39) |
| `cloud-image-sentry`, `cloud-image-bundled-plugins`, `container-init-reaping`, `docker-build-stamp` | Read `.github/workflows/{release,docker}.yml`, which the quarantine (#494) deleted | open: retire them, or point them at Bostan-owned fixtures |
| `server-package-build-script` (4), `verify-runner-vendor-dependencies` (1) | Expect pre-lockdown build/pack scripts and messages | open |
| UI copy (about 40 tests in `workspaces-a`) | Expect "Paperclip" or `npx paperclipai …` where the UI now renders Bostan | open. Verify each against the rendered product, then update the expectation, not the product |
| `tool-access-service` (19) | Expect `paperclip-*` credential profile IDs | open. Product or test? |
| `vitest-chat-shards` | Chat shard manifest drift | open |

## C. Real product defects found

| Item | Status |
|---|---|
| `idle-database-backup.ts` fsynced a directory handle and a read-only file handle, which Windows rejects with EPERM. Post-restart backup marking and idle backup verification failed on native Windows | **fixed** `6218ad4e` |
| 12 Bostan routes (B2–B5 evidence, decision, readback, analytics) missing from the OpenAPI spec (`openapi-routes` "covers the mounted server routes exactly") | open |
| About 10 user-visible server errors still say "Paperclip Runner" (`routes/agents.ts`, `adapters/registry.ts`, `tool-gateway.ts`, `agent-runner-selection.ts`, `external-agents/*`) | open (#35) |
| Plugin auto-build leaves `@bostan/plugin-sdk` runtime dependency missing for standalone bundled plugins (`plugin-install-autobuild`, 6 tests) | open. Investigate |
| "Verification must be assigned to a different agent from the implementer" rejects fixtures in `issue-recovery-actions` and `case-handoff-privacy` (3 tests) | open. Rule vs fixtures |
| `cloud-runtime-identity`, `git-workspace-expiration`, `workspace-runtime`, `registry` (ACPX env), `board-mutation-guard` | open. Investigate |

## D. Environment or flaky (rerun before acting)

| Item | Status |
|---|---|
| `spawnSync cargo ETIMEDOUT` (`dot-runner`, `native-codex-runner`): cold Rust release build inside a test | open. Consider pre-building the runner binary in the lane |
| `idle-sleep-safety`: "POSIX embedded PostgreSQL stop timeout; retaining fixture" | open. Rerun first |

## Locally unrunnable on the owner's Windows PC (Linux CI is authoritative)

- Embedded PostgreSQL suites skip themselves on this host.
- File-symlink fixtures need Windows Developer Mode.
- Tests shelling out to `python3` or a cold `cargo build --release`.
