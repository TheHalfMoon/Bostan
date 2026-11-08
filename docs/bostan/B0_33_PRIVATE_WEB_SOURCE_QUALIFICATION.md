# B0-33 — Reproducible no-Rust Bostan web source preflight

2026-10-27. Stacked private draft above B0-32; **no release, deployment, public repository mutation, main merge, cloud spend, or inherited Actions enablement**.

## Change

Added `scripts/bostan-web-qualification.mjs`, a six-stage standalone source check with a read-only JSON `--plan` default and explicit `--run` mode. It runs the official Bostan Plugin SDK/shared build, Runner TypeScript-only build, UI TypeScript and Storybook catalog check, Vite production UI build, direct server TypeScript check, and four targeted Vitest suites for organization switching, new-agent creation, and onboarding. Model/API/database credentials are removed from child-process environment before execution. No `cargo`, database migration, paid model, release/package publishing, or native OS binaries are invoked. Any failing step terminates the preflight rather than weakening the gate.

Updated UI Vitest configuration to Node ESM `import.meta.dirname` instead of `__dirname`, eliminating the detected Vite `configLoader: native` compatibility warning without muting warnings or changing the Vite config-loader mode.

## Evidence

- Clean filtered `pnpm install --frozen-lockfile --ignore-scripts` for `@bostan/ui...`, `@bostan/server...`, and CLI prerequisites: PASS.
- `@bostan/plugin-sdk` build (including `@bostan/shared`): PASS.
- `@bostan/runner build:typescript` (including `@bostan/eval-kernel`, ACPX profiles and protocol generated source contracts): PASS, no Cargo.
- `@bostan/ui typecheck`: PASS; Storybook catalog indexes **316 files, 2,973 stories**, structure only.
- `@bostan/ui build`: PASS; Vite production output approximately **22 MB** on disk, with large-chunk advisory warning (performance follow-up, not a build failure).
- `@bostan/server exec tsc --noEmit`: PASS on source once the Runner declarations were built. This is not the official server production build, which invokes native Rust qualification.
- Four targeted UI Vitest files: **27/27 PASS**, no model or database API use.
- New preflight unit tests: **2/2 PASS**; read-only plan and invalid argument behavior verified.

## Explicitly unqualified

Full native Rust daemon (`cargo check/build`), Windows/Linux installed desktop, actual Postgres migration/recovery, browser E2E against a real server, paid/free-model real-agent comparative execution, independent security assessment and final release approval remain untested by this wave. The existing donor release-canary workflow tests and third-party legal provenance retain their own compatibility requirements. **Release NO-GO.**
