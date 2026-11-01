# B1-188 — Fail-closed, non-destructive workspace links preflight

Date: 2026-11-02 (Asia/Riyadh). **Private Draft engineering only; release remains NO-GO.**

## Actual bug and ownership impact

Root `preflight:workspace-links` is called before Bostan root build/typecheck/tests and dispatches `scripts/ensure-workspace-package-links.ts`. Its previous exact GitHub blob `8e26d521a39623176c3912acf59372dbe4c6eaa0` performed `fs.rm(linkPath, { recursive: true, force: true })` on *any* mismatch before creating a replacement symlink. A preexisting ordinary directory with a foreign `KEEP.txt` could be deleted. A dangling or foreign symlink could likewise be replaced without proof of ownership. Package name components were inserted into filesystem paths without validation, allowing `../` traversal; discovered duplicate workspace package names silently overwrote each other in a Map. This was reproduced earlier in owned synthetic Linux QA; no user checkout was modified.

## Source repair

New `scripts/ensure-workspace-package-links.ts` first scans all discovered package names and refuses duplicates or malformed names, validates package directories and manifests, gathers all `workspace:` dependency links, refuses unowned/mismatched links or ordinary directories and symlinked parent directories, and checks *all* discrepancies before writing anything. It no longer calls recursive `fs.rm`, does not replace an existing entry, does not claim to install third-party dependencies, and refuses absent `node_modules` when workspace links are required.

Only after a successful complete preflight does it create missing links with native `fs.symlink` (Windows directory junction). It rechecks the parent and leaf before each creation and refuses changed entries. Existing valid links remain unchanged. This is **fail-closed**, not an atomic multi-process filesystem transaction: a concurrent actor could still race a path replacement after a check; cleanup and OS handle ownership are separate release gates. Scope and foreign-path errors use bounded reason codes rather than raw absolute paths.

## Exact source and test evidence

Branch `work/b1-188-workspace-links-nondestructive-preflight`, directly branched from #444 exact `8389e072967e157e283ba748461a3b50e2243871`:

- Source blob `35565f2391538b361f1bc0250cde6981d4f324ea`
- Node test blob `1312a103aee3f4ae15c5d75882a1d9d8a2a74a06`

All code/tests are persisted in the private GitHub branch. Both hashes were independently matched against local tested sources.

**Native isolated Linux Node22**: `node --test scripts/ensure-workspace-package-links.test.mjs` in owned synthetic fixtures **15/15 pass, 0 skips, exit 0**. Targeted TypeScript5.8 with Node types `--strict --noEmit --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions`: **exit 0**. This is NOT root TypeScript7 qualification.

**Native Windows 11 Node24.19.0**: exact GitHub source and test blobs written into an exclusively owned `D:\\Bostan-B208-qa` scratch fixture, `node --test --test-reporter=spec`: **11 passed / 4 explicitly skipped / 0 failed, exit 0**. Skips are exclusively native Win32 `EPERM` creating foreign/dangling/scope-parent `fs.symlink` in unprivileged mode; they are not falsely reported as Windows security coverage. Actual valid missing workspace link, ordinary-dir preservation, name/path traversal refusal, duplicate-name refusal, all-workspace preflight of conflicting links, safe missing scoped parent, and non-workspace controls passed natively. Global `postgres.exe` count remained 0; no real PostgreSQL was started. Tests create and destroy only their synthetic per-test `bostan-b208-linker-*` scratch roots.

## Remaining qualifications

Do not run full root build/typecheck or old destructive linker across an existing user checkout prior to the relevant PR stack being safely applied. Qualified source is currently **stacked Draft**, not merged.

Bostan release still **NO-GO** pending #234 repeated genuine native Windows forced-crash PostgreSQL `io_worker` orphan-zero proof and ownership checks; #237 clean exact-head compiled Windows authenticated localhost HTTP Better Auth signup/admin/roles/tenant and Chromium; full installed cross-OS/TS7/Vitest native Linux sandbox, privacy, security, consent and donor license/NOTICE. No main merge, Actions, release, deployment, paid services, foreign process stops or unowned deletion were performed.
