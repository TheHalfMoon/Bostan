# B1-49: Windows packed Chromium authentication — real test RED

2026-10-29. Stacked private Draft on #302, exact parent 720d2ecfa5b2a8bc8db0730cc17349685b589e5e.

Added a test-only opt-in --run-compiled-browser mode to the existing native Windows private HTTP harness. It checks local Chromium and built UI before creating a database, runs the actual SHA256-bundled backend with real isolated PostgreSQL, and intends to use existing browser signup and first-admin workflows. The backend-only modes remain unchanged. Extra memory admission protects the user device; the combined browser mode requires 4 GiB free before launch, and 3 GiB after migration.

Actual Windows test at f753756e15f0d1e920ff7ac1b8ab8ae8382ab479:
- The focused native Windows browser/environment tests passed 7/7.
- One initial run refused low free memory before PostgreSQL creation.
- A later run with 3.27 GiB free passed browser preflight and real PostgreSQL migration.
- The compiled server did not reach HTTP health before the 180-second deadline (178 probes); no browser signup or first-admin was attempted. Outcome RED, exit 1, 219.77 seconds total. The source of the delay is not yet proven.
- Cleanup was GOOD even on failure: owned child closed, PostgreSQL cleaned, independent no-orphans proof passed, owned disposable fixture cleaned. Independent post-run Windows scan found zero owned Node and zero postgres processes.

B1-46 backend-only Windows PG/Better Auth HTTP was independently GREEN; B1-48 Windows Chromium UI first paint was GREEN. The combined Windows browser-to-auth-server proof is still RED. Do not infer cause merely from those differing results.

The new stricter preflight and corrected stale profiler-path assertions passed 26/26 focused Mac tests. These later edits require a new Windows run under sufficient free RAM; no such full run is claimed.

Release remains NO-GO. Still required: Windows browser authentication, UI TypeScript checking, offline local agent, Linux/installers, multi-suite PG stress, and security/privacy/licensing reviews. No publish or protected-main merge.
