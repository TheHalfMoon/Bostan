# 0001. Electron desktop shell

Status: accepted (2026-11-10)

## Context

Bostan already has an Express backend, embedded PostgreSQL, native Runner and
React UI. Its runtime requires Node >=24.11. Electron 45.2.3 pins Node 24.22.2
and Chromium 156.0.8078.80 in its official DEPS file. Windows x64 and macOS
ARM64 need installers with a real application window and no developer setup.

## Decision

Use Electron for the primary desktop shell. Run the compiled backend in a
separate Node utility process, reuse the HTTP UI, and ship the production
dependency closure and native assets with the application. Keep Node disabled
in the renderer, context isolation and sandbox enabled, and expose no renderer
IPC bridge. A private child-process channel controls lifecycle.

Tauri would require a separately distributed Node sidecar and introduce another
runtime/toolchain boundary. A browser-only managed launcher would leave window
and application lifecycle dependent on the user's browser. Neither is the
primary desktop architecture.

## Consequences

- Existing onboarding, authentication and persistence remain owned by the server.
- Electron increases download size and requires Chromium security updates.
- Backend state belongs in the per-user application-data directory, outside
  installation files. Uninstall preserves it by default.
- Windows NSIS and macOS DMG preparation remain publication-disabled. Signing,
  notarization, actual installer acceptance and native platform qualification
  are independent release gates; choosing a shell does not satisfy them.
