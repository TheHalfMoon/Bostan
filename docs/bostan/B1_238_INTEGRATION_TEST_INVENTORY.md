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

## Update — after fix batches 1–3 (CI runs 42435409056 and 42438361299, plus local Windows reruns)

### Lane progress

| Lane | First run | Latest |
|---|---|---|
| typecheck, gates, windows, workspaces-c, serialized-2, chat | various failures | **pass** |
| workspaces-a | 14 failed files, 54 failed tests | 3 files, 45 tests |
| workspaces-b | 1 file | 1 file (`adapter-utils` exports, fixed in `6b31aac4`) |
| server-1 | 14 files | 8 |
| server-2 | about 14 | 3 |
| server-3 | 12 | 3 |
| serialized-1 | 3 | 2 |

### Newly fixed product defects

| Defect | Commit |
|---|---|
| Portable asset copier could not replace read-only outputs on Windows | `291be031` |
| System notices and voice transcript showed "Paperclip" | `5d929fad` |
| MCP client snippets said "Use the full Paperclip origin" | `2ed286bf` |
| A missing ACPX package lost its actionable guidance after the redaction work. Fixed message only, no raw text | `7be756eb` |

### Tests updated to deliberate Bostan behaviour, intent kept

| Area | Commit |
|---|---|
| Release lockdown and portable copier | `08d4a942` |
| Workflow quarantine | `9e0dfa7c` |
| Same-scheme Origin rule `b2d88f90` | `f6da7e90` |
| No donor CLI commands shown | `fed7fb66` |
| Private conditional exports | `6b31aac4` |
| UI copy | `faf4a279`, `d511a64e` |

### Open — product decisions or deeper work

| Item | Notes |
|---|---|
| `tool-access-service` (13) and AppsConnect retained-Workspace and Notion sign-in (about 30) | Tests drive the donor Cloud broker (`my.paperclip.app`), which `07b3b385` deliberately refuses. Rewrite them against an opted-in private broker (`BOSTAN_CLOUD_CONNECTOR_ENABLED=1`, `BOSTAN_CLOUD_CONNECTOR_BASE_URL`). Confirm with the owner whether Workspace connect via a private broker is in scope |
| User-visible or third-party donor identity still in `server/src` | OAuth `resource_name` (`routes/public-mcp.ts`); git restore-point author and committer (`git-restore-point.ts`); 1Password `integrationName`; GitHub `user-agent`; default skill author (`company-skills.ts`); CLI approval page shows `paperclipai auth login`; "Paperclip Runner" errors (`routes/agents.ts`, `adapters/registry.ts`, `agent-runner-selection.ts`, `external-agents/*`) |
| OnboardingWizard (4) | Pass alone, fail in the full file: state leaks between tests. The hire-after-Back assertion must be proven on a clean run before closing |
| GitHubChatSetup (1) | Error copy changed ("Could not verify this GitHub App") |
| OpenAPI | 12 Bostan routes undocumented; in progress |
| Verification-agent rule | "Verification must be assigned to a different agent" rejects fixtures in `issue-recovery-actions` and `case-handoff-privacy` |
| Other server tests | `heartbeat-process-recovery`, `cloud-runtime-identity`, `git-workspace-expiration`, `workspace-runtime`, `plugin-install-autobuild`, `vitest-chat-shards` |
| CI environment | cargo cold-build timeouts (`dot-runner`, `native-codex-runner`); POSIX PostgreSQL stop timeout (`idle-sleep-safety`) |
