# B0-31 — Native private Bostan Runner npm package and owned CLI entrypoints

2026-10-27. Private draft source wave stacked on B0-30; no main merge, publish, deployment, enablement of inherited CI Actions, or paid inference.

Replaced the final outstanding inherited `@paperclipai/paperclip-runner` npm identity with **`@bostan/runner`** and renamed its five JavaScript entrypoint commands to `bostan-runner-*`. Updated source imports, server dev dependency, test sources and trusted build references. The workspace is `private: true`, has no inherited public `publishConfig`, points metadata to `TheHalfMoon/Bostan`, and invokes the fail-closed Bostan guard for `prepack` and `prepublishOnly`. Regenerated `pnpm-lock.yaml` offline and relinked Runner and server from that frozen lockfile.

**Protected compatibility:** The internal source folder `packages/paperclip-runner`, Rust crate `paperclip-runner-core`, compiled daemon `paperclip-runnerd`, protocol schema identifiers, OCI/archive binary contract and persisted data/wire formats remain unchanged. No unverified rename of the Rust daemon or installation metadata occurred. Directory and Rust protocol terminology still require an explicit compatibility-qualified migration before final identity signoff. Retaining versioned identifiers is intentional until evidence proves otherwise; third-party attribution remains intact.

## Verified

- Filtered frozen pnpm install PASS (bin symlink warnings before the build were due to absent generated entrypoint files).
- Runner official `typecheck:typescript` PASS, including TS 7.0.2, ACPX profile checks, schema generation parity, `@bostan/eval-kernel` build and both surface compilers.
- Runner official `build:typescript` PASS and five corresponding `dist/cli` entrypoint files created; Copilot runtime assets installed from free local package for macOS arm64.
- Standalone forbidden-import guard PASS and acyclic runtime/testing/eval boundary check PASS.
- Forbidden-import, native provenance and atomic binary staging focused suites: **57/57 PASS**.
- Stable Vitest workspace/shard scheduler regression: **32/32 PASS**.
- Native Bostan Runner/private DB identity and no-publish guard: **7/7 PASS**.
- Inventory of `packages/**/package.json`: no remaining npm package names beginning with inherited `@paperclipai/` prefix (the corpus has retained internal filesystem names and legal provenance as noted above).

## Unqualified / open

Full `cargo check --locked --workspace`, compiled Linux/Windows Rust daemon, full production server/GUI builds and end-to-end installed workflows, real persisted DB recovery/upgrade, multi-OS security/e2e, model-authored governed Case and independent readiness review remain open. This is a package identity transition, not general release clearance. **Release NO-GO**.
