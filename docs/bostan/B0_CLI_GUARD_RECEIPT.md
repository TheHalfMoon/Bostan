# B0-03a — Native CLI identity and release safety gate

Status: source-only development preview; NOT B0 completion; no release authorization.

## Exact lineage
- Parent B0-02 product-copy branch at 60613a57289a015758685517c3422773aaa95d6d.
- Work branch: work/b0-cli-guard.

## Implementation
- Root and CLI package name is Bostan. New bin named bostan; root developer script pnpm bostan.
- Independent CLI preview only accepts help and version arguments. All operational commands exit 2 without importing old installation or runtime modules.
- CLI package is private and the release manifest marks it as not publishable.
- Root npm packaging, release/channel/rollback/bootstrap scripts fail closed.
- Default CLI build creates only dist/bostan.js; legacy CLI stays in source but is not exported as a package bin.
- CLI README identifies the limitation; original MIT license and copyright text stays in the package.

## Verified
- 5 of 5 built-in node tests passed, including no writes to isolated HOME and refusal of inherited operational commands.
- pnpm --filter bostan build: PASS.
- CLI dist version: 0.3.1; update --latest: refused with exit 2.
- npm pack --dry-run --ignore-scripts --json: PASS from cli directory; package bostan, contents LICENSE, README.md, dist/bostan.js and package.json. Nothing was published.
- pnpm install --lockfile-only --ignore-scripts: PASS; no lockfile changes.
- git diff --check: PASS.

## Not qualified
Native Bostan storage, managed shim, service names, installer, update/rollback engine, runtime safety and full dependency namespace migration are not implemented. Old package/env/storage/URL references remain in legacy source. This preview cannot run a company or launch an agent. GitHub Actions remain disabled and no software was deployed.

Next: privacy/telemetry/egress defaults, then safely rebuild Bostan-specific installation and services behind fresh tests.
