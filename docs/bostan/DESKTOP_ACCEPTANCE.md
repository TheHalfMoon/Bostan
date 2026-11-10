# Desktop acceptance and continuation

Date: 2026-11-10. Product status: **not release-qualified**. No release, tag,
deployment, signing or notarization has been performed.

## Source and active work

- Last verified main: `c838939bb5f3d6cf38bd79b264809025b6402a4a`, 15 CI jobs passed.
- PR #540 (`work/compiled-server-qualification`), head `9ca0b1e8`: fixes missing
  database JavaScript assets, adds a real compiled Windows API journey, and
  runs it under a fresh standard Windows CI user. Full final-head CI pending.
- PR #542 (`work/desktop-runtime`): Electron desktop, production dependency
  staging, unsigned packaging and installed Windows qualification. It includes
  #540 until that parent is merged. Full artifact CI pending.
- PR #541 is separate active work on inherited install guidance; do not duplicate it.

## Evidence actually executed

| Gate | Result |
| --- | --- |
| Windows desktop unit/policy/NTFS/relocation tests | 8 passed |
| Native Electron 45.2.3 host regressions | 3 passed |
| Embedded Node version from actual Electron executable | 24.22.2 |
| Desktop dependency audit, pinned lockfile | 0 reported vulnerabilities |
| Independent correctness/product and security review | initial findings fixed; delta reviews pass |
| Workflow publication quarantine | passed locally |
| Complete hosted Windows server/dependency/Rust build | passed, then runtime qualification failed as described below |
| Actual NSIS construction/install/onboarding/restart/uninstall | not yet executed |
| macOS ARM64 DMG construction | not yet executed |
| macOS installed-app launch/data lifecycle | acceptance implementation and native evidence still required |
| Live model execution, update/rollback, full network capture | unqualified |

The native host fixtures prove compiled workspace exports, an actual embedded
Node subprocess, quit during startup, cross-origin redirect cancellation before
the target is requested, and a visible window/retry after rejected shutdown.
They use synthetic backend code; they do not prove real PostgreSQL or a real
agent run. The data-directory test exercises Windows ACL changes and repeated
launch on disposable directories without elevation.

## Failures preserved

The initial full Windows build failed on CRLF-altered protocol fixtures. Checkout
now disables conversion before reading the hashed sources. The next build
passed, but compiled startup missed three `.mjs` database helpers; the database
build now copies their unchanged bytes, with source-removal regression coverage.
The next compiled startup loaded the module graph but PostgreSQL refused the
elevated GitHub runner token. The new CI launcher uses a separate standard user
and retains PostgreSQL's administrator protection. That launch still needs its
first hosted pass; operator-PC refusal is independently tested.

Local diagnostic-only server emission is not a qualified build. A diagnostic
attempt failed on absent local compiled migration assets, and its retained
fixture was removed only after independent zero-PostgreSQL proof. Do not reuse
those diagnostic server outputs as final acceptance evidence.

## Reproduce and continue

```sh
npm --prefix desktop ci
npm --prefix desktop test
npm --prefix desktop run test:host
pnpm --filter @bostan/server... --workspace-concurrency=1 build
pnpm --filter @bostan/ui build
npm --prefix desktop run package
```

Full builds should run serially on a host with adequate available RAM. This
operator PC fluctuated below 1 GiB free; heavyweight qualification uses hosted
CI. `scripts/bostan-ci-windows-user.ps1` refuses operator PCs and is for an
explicit disposable GitHub Windows runner only. Its Server mode runs the real
compiled auth/claim/tenant journey; Installer mode runs the prepared Windows
artifact test under a new standard user with its own profile.

Next: follow final-head CI for #540 and repair actual failures. Review and merge
only after all required checks pass, verify main, then requalify #542 on the
updated main. Windows installer acceptance must check executable/registry removal
before claiming data-retaining uninstall. Mac build-only evidence cannot satisfy
installed macOS lifecycle acceptance. Artifacts remain unsigned and unpublished;
OS signing/notarization and public release require explicit owner authorization.
