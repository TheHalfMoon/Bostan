# B0-73 — Fail-closed native Linux TypeScript and Rolldown build dependency admission

**2026-10-27/28**, private Draft stacked over B0-72 PR #221 (`6c1e25e161a5bd4b8e356081ba56b7c8bc3bb6e8`). Repo remains PRIVATE, GitHub Actions disabled, no merge to main, release, registry publishing, deployment, paid AI inference or real customer data.

## Reproducible finding

B0-72 Linux qualification initially failed before compiled Bostan HTTP because its `--no-optional` workaround removed the **required** native TypeScript 7 Linux compiler binary `@typescript/typescript-linux-x64@7.0.2`. An isolated frozen-lockfile install with all optional dependencies enabled for the small `@bostan/shared...` filter then restored this native binary, and **`pnpm --filter @bostan/shared build` passed on the real Ubuntu 26.04 x86_64 WSL2 machine** using official Linux Node 24.19.0. A later wide filtered install with a **temporary uncommitted QA-only** `pnpm-workspace.yaml` Linux x64 glibc architecture selection and a narrowly excluded irrelevant `opencode-linux-x64-baseline-musl` / `opencode-linux-x64-musl` optional pair completed successfully under frozen lockfile. No versions or main lockfile were changed. This QA overlay is not proposed as a cross-platform production setting because it would incorrectly restrict musl hosts.

This also showed a previous partial pnpm install can rearrange workspace `@types/node` and `@types/react` links; a green download counter is not evidence the build dependency closure is intact.

## Code changes

- New opt-in, **read-only**, default-inert `scripts/bostan-private-linux-native-build-closure.mjs --check` validates the actual Linux x64 glibc Node >=24 execution platform, the **seven actual installed dependency manifests** and native version consistency: TypeScript, its Linux native binary, Node and React type definitions, Vite, Rolldown and its Linux glibc binding.
- The existing private staged full-app acceptance invokes this gate **after frozen offline installation but before expensive compilation**, only when `BOSTAN_LINUX_PRIVATE_TMPFS_QA=1` is explicitly set. Failed native package binding is a hard **exit 2** rather than an expensive late compile failure. It does not disable any optional dependency, run a model, modify workspace files or change other platforms' behavior.
- Focused pure tests simulate missing native TypeScript/Rolldown/type definitions, mismatched native package versions and inappropriate platforms; unknown publication/run flags are denied.
- No production server, UI, tenant authorization, database, dependency lockfile or release workflow changes.

## Actual verification

- Mac ARM64 Node 26: **13/13 B0-73 closure and Linux resource/stage admission tests PASS**, 0 failures and skips. The Linux-only admission remains intentionally inactive on Mac.
- Mac actual compiled private server + Vite UI, frozen/offline deploy, verified relocation, real PostgreSQL, real Chromium first-paint and synthetic company/task CRUD ran on exact B0-73 implementation: **EXIT 0** (~87 seconds); browser **0 JavaScript errors**, **0 external requests**; two companies and two issues over **13 HTTP requests**, **0 remote models**. Markers `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS`, `CLEANUP_COMPLETED exit=0`.
- Ubuntu 26.04 WSL2 with official Linux Node 24.19: **5/5 native-dependency closure unit tests passed**, 0 fail. The **actual seven installed native packages verified** with `--check`: TypeScript 7.0.2, Linux native compiler 7.0.2, Vite 8.2.2, Rolldown 1.2.5, matching Linux glibc Rolldown native 1.2.5 and the required Node/React types.
- A real Linux compiled server build **progressed through TypeScript/Runner ACPX contract and eval-kernel checks** after repairing the dependency closure; but on default `/mnt/d` WSL DrvFS the pinned native Copilot provider binary appeared world/group writable (mode 0777), and Bostan correctly rejected it: `Copilot executable has unsafe permissions`. **This refusal is real evidence that Bostan's security check remains active, not a passing Linux HTTP result.**
- An isolated **transient DrvFS `metadata` mount**, created and removed in the **same root-controlled WSL session**, was used to present the QA source with accurate POSIX permission bits. The actual build ran as the unprivileged Linux user (`shehri`), not root. The original pinned Copilot permission/digest verifier remained untouched and printed **`Copilot runtime assets: installed (linux-x64)`** on this QA mount; the source first-party protocol checks and TypeScript build passed. **This is a test of WSL file-mode presentation, not independent validation of underlying Windows NTFS ACLs, and cannot certify end-user native Linux packaging.**

## Remaining release gates

A full Linux compiled server + temporary PostgreSQL + HTTP 200 + deployment + UI/runner + browser remains unqualified until all its actual Bostan acceptance markers and cleanup exit 0 are verified. The cross-platform native end-user installer, true NTFS permissions/auditable Windows package, legitimate free-model agent task completions, comprehensive third-party license notices and independent security release qualification also remain OPEN. **Do not publish Bostan.**
