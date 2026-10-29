# B1-37 — Native Windows Runner Rust and cross-platform adapter build blockers

Date: 2026-10-29. This repository remains PRIVATE and strictly NONPUBLISHING. Exact stacked parent B1-36 Draft PR #289 at `2e4275d08f385f48d3baea483609b5d09a83293e`.

## Real native Windows Rust error reproduced and repaired

The exact B1-36 source `packages/paperclip-runner/runner/crates/runner-core/src/process_supervisor.rs` fails Windows release build with Rust `E0599` at line 461: `self.inherited_command()` is only compiled for Linux/macOS but was called by an unconditionally compiled `spawn_stdio` method. This was discovered by the real `pnpm -r --workspace-concurrency=1 --filter '@bostan/server^...' run build` on authorized native Windows Node 24.19.0/Cargo 1.97.1. The initial build compiled 276 Rust crates, then failed with exit 101 at this exact source error. Rust warnings are not the cause.

**Repair:** preserve the existing verified immutable-file-descriptor/named-executable stdio launch on Linux and macOS. On unsupported targets (including Windows), return a deterministic `LocalRunnerError::invalid` before spawning anything. Do **not** silently fall back to an unverified direct Windows process path; immutable verified process snapshots are not implemented for Windows. Added a platform-scoped Rust test that asserts fail-closed refusal without spawning a process. (The targeted Windows cargo test binary itself has not yet been executed; do not misreport this source test as run.)

**Actual verification:** after the fix, `cargo build --release --manifest-path runner/Cargo.toml --locked -p paperclip-runner-core --bin paperclip-runnerd` on real Windows **EXIT 0**, `release` optimized compile finished in **5m46s**, with only nonfatal lint warnings. This is a genuine native Windows binary build, not a cross-compile. The corresponding Mac `cargo build --release --manifest-path runner/Cargo.toml --locked -p paperclip-runner-core --lib` **EXIT 0**, build ~39s.

## Native Windows shell command blockers identified and fixed

A subsequent full Windows transitive package build passed Runner Rust, shared/license copy, plugin-sdk and skills-catalog, but failed when `@bostan/adapter-codex-local` invoked Unix-only `cp` from its `package.json` build script. After replacing it with a narrow Node fs copier, the actual Windows `@bostan/adapter-codex-local build` **EXIT 0**, and Mac also **EXIT 0**. Its new isolated tests ran **Windows 2 PASS / 1 SKIP** (file symlink creation blocked by Windows OS privileges), **Mac 3/3 PASS**. Exact byte copy and preservation of a foreign sentinel were checked; all destination links are validated before writes.

The next full build exposed the same Unix-only `cp` dependency in `@bostan/adapter-grok-local`. Replaced it with a similar Node copier and narrow file-ownership checks, without changing Grok credential merge algorithms. Actual `@bostan/adapter-grok-local build` **EXIT 0** on Windows **and** Mac; regression tests **Windows 2 PASS / 1 SKIP** and **Mac 3/3 PASS**.

Audited every `packages/**/package.json` build script for obvious raw `cp`, `rm -rf`, shell and mkdir operations. The only further raw `rm -rf dist && tsc` uses found were eight plugin sandbox provider packages outside the active transitive server build graph. Those need separate scoped Windows qualification when relevant; they were **not** modified here.

**Full transitive Windows dependency graph:** ran `pnpm -r --workspace-concurrency=1 --filter '@bostan/server^...' run build` from clean isolated `D:\Bostan-B135-qa` at exact code commit `3e8a926048df8be3fcbf098734bde8b6a28c3ba4`. **EXIT 0**, confirmed completed Runner and the final Hermes adapter, with **~3GiB RAM and ~11.11GiB D available**. No changes to protected main, lockfile, customer data, or unrelated user files.

## Full Windows server build still NOT qualified

After transitive dependency success, native Windows `pnpm --filter @bostan/server build` started, verified reuse of its current Runner vendor build and progressed to TypeScript. Available system RAM then fell to **~0.45GiB**, violating the safety margin. The assistant deliberately terminated only its **owned Bostan build terminal session** (PID 12432) and inspected afterwards. Later read-only Windows inspection showed **0 Bostan-B135-qa Node/Cargo/tsc child build processes** and available RAM recovered to **~6.83GiB**. No unrelated user/Codex/Orcel processes killed, no user data deleted. This interruption is **NOT a server build PASS** and has no final TypeScript compile receipt.

The Mac B1-36 isolated real compiled server already built via pinned esbuild0.28.2 and reached localhost HTTP health in 14.367s, but the Windows compiled server `dist-runtime` + full 18-stage authenticated private PG/HTTP #237 and broad Windows PG orphan process #234 are **not yet qualified**. Other gates: full real browser/Chromium, first real no-cost local agent, installers, provenance/privacy/security; no release.

No paid compute/models, public deployment, GitHub Actions activation, merge to protected main, release or npm pack. Keep this and all subsequent PRs DRAFT, release **NO-GO**.
