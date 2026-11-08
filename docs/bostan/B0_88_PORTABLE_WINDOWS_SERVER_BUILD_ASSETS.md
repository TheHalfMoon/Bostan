# B0-88 — Portable Windows server build asset copy

2026-10-28 — Private Bostan stacked engineering wave, following B0-87 PR #238. No release, no merge, no paid inference, no existing-user environment touched.

## Observed build blocker and change

Bostan's `@bostan/server build` used POSIX shell `mkdir -p`, `cp -R`, `cp -Rf` and multiple `cp` commands after TypeScript compilation to stage onboarding assets, built-ins, server service scripts, the complete runner dist tree and three Copilot helper scripts. These shell commands are not portable to native Windows Cmd/PowerShell.

The build now runs `node scripts/copy-build-assets.mjs` at the exact same position between `tsc` and `dist/install-copilot-assets.mjs`. It preserves:
- The full original source directory trees and binary file bytes in the same output layout.
- The three original Copilot helper script filenames.
- Unrelated already-compiled `dist/index.js`, timestamp/build files and build stamp step.
- The existing runner build and vendor-dependency verification sequence; neither is bypassed.

The copier checks the server package name and verifies **all** input paths before copying any output. It refuses missing source files, symlinks in source trees (including broken links), symlinked output ancestors or trees, and non-file inputs; it uses Node filesystem calls only, no shell or new dependency. It does not copy `node_modules`.

## Actual qualification

- macOS Node: **7 passed, 0 failed, 0 skipped**, exit 0. Original exact-byte copy, required output locations, retry/idempotence, preservation of compiled JS, missing-input fail-before-write, foreign package denial, symlink inputs and dangling destination denial, and absence of POSIX copy/mkdir tokens in the build script.
- Native Windows 11 (Abdulaziz), Node 24.19.0, a fresh private checkout and **no pnpm dependency install**: **5 passed, 0 failed, 2 explicitly skipped** because this Windows account cannot create symlinks, exit 0. The two skipped symlink protection paths were exercised successfully on Mac, NOT proven by that Windows account. No live Windows server/database was started in B0-88.
- Checkout remains PRIVATE, actions remain OFF, branch stays stacked over B0-87. No production build is claimed.

## Still not qualified

This **does not** fix the 182-second Windows `static_import_start` stall in B0-87. The complete Windows `tsc`, Runner Rust build, full `@bostan/server build`, authenticated localhost startup, Chromium login/first-admin journey, real agent completion, installer, full licensing/security remain unqualified. In B0-87, the standalone compiler did not emit `dist/index.js` under severe disk pressure and was stopped without claiming success. The current next blocker is constrained TypeScript import/build investigation, without reproducing the previously observed low-space incident.

**Overall Bostan release NO-GO**; no merge or publish.
