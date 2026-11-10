# Bostan desktop

Electron hosts the existing compiled Bostan server and UI. Desktop development
tools have a separate pinned npm lockfile; they do not alter the product's pnpm
dependency graph. Install them with `npm --prefix desktop ci`. Electron's
download/install hook is required to fetch its pinned platform binary.

```sh
pnpm --filter @bostan/server... --workspace-concurrency=1 build
pnpm --filter @bostan/ui build
npm --prefix desktop test
npm --prefix desktop run package
```

Packaging creates a fresh production `pnpm deploy --prod --ignore-scripts`
payload, checks dependency containment and compiled assets, adds the built UI,
and includes it as application resources. Windows junctions are recorded and
recreated inside the installed application on first launch; Unix links are made
relative before packaging. The actual runtime cannot depend on the source tree.

`desktop/dist` receives unsigned installer artifacts, SHA-256 checksums, a
CycloneDX software inventory and a declared-license/notice inventory. The latter
does not replace independent third-party license review. No package is
published, signed or notarized.
Unsigned installers are not OS-trusted releases. Actual installed-artifact
onboarding, PostgreSQL lifecycle, restart, failure recovery and platform
qualification must pass before any release-readiness claim.

The renderer has no Node integration or IPC bridge. External navigation and new
windows are blocked; browser permissions are denied by default. Provider/OAuth
handoffs and microphone workflows need explicit desktop qualification before
being advertised as supported.

Application state lives under the OS user's Bostan application-data directory,
outside installation files. Authentication is private and signup/first-admin
claim use the existing server flow. Uninstall preserves application data.
Startup and shutdown failures keep data in place. Native Windows tests exercise
private NTFS ACL application and repeat launch without administrator privileges.
Actual installed application acceptance and signing/notarization remain open gates.

The native Electron host regression uses a synthetic backend to verify compiled
package exports, embedded Node subprocesses and shutdown during startup. It does
not prove real PostgreSQL startup or agent execution. `npm audit` initially found
six moderate build-tool findings from minimatch; a pinned minimatch 11.0.1 override
removed them (zero findings). Full artifact construction must validate compatibility
of that override; an audit result alone is not package qualification.
