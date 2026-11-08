# B5-32 — Bundled Darwin PostgreSQL dynamic library aliases

Private Bostan source work. No main merge, release, deployment, GitHub Actions, paid provider or user database changes.

## Root cause reproduced from actual native binaries — 2026-10-26

Full native runner authority integration previously failed in beforeAll: embedded PostgreSQL could not initialize and 29 agent authority tests were skipped.

Direct inspection and a bounded clean initdb of bundled macOS PostgreSQL 18.1 revealed missing dynamic linker aliases in the bundled native/lib directory:
- libicuuc.77.1.dylib required libicudata.77.dylib.
- Bundled postgres required libzstd.1.dylib.
- Bundled postgres also required unversioned libicui18n.dylib.

All target libraries already existed in that same native package with patch-versioned names. System PostgreSQL 17 initdb worked as a diagnostic, but the project was not switched to an external or system database.

## Source change

The existing bundled-native preparation now covers darwin-arm64 and darwin-x64, alongside its unchanged Linux support. macOS gets only local relative symlinks from existing patch-versioned dylibs to exact-major sonames. ICU alone additionally gets unversioned aliases where bundled binaries demand them.

No new libraries are downloaded, no different major versions are linked, and existing paths are not replaced. Files are created solely in the package-owned native/lib area. The code is idempotent and does not change process spawn semantics, system binaries, migrations, or user records.

## Actual qualification

- Bostan DB native runtime Vitest: 6 PASS, 0 FAIL, including library aliases, idempotency, existing-file preservation, portable locale and untouched spawn API.
- Real bundled migrated PostgreSQL 18 and server native runner tool-authority plus verification schema: 32 PASS, 0 FAIL, 0 SKIP in two suites. Previously 29 of these tests had never executed due to library initialization failure.
- Broad Bostan Node source: 147 PASS, 0 FAIL, 9 Windows-specific SKIP.
- Official DB TypeScript command: pnpm --filter @paperclipai/db exec tsc --noEmit --pretty false, exit 0.
- No user or third-party service operations, and no paid model inference.

## Open release gates

Real first free-model agent task Done with exact run-owned comment and readback, independent reviewer and canonical Case, official full server TypeScript/build, Windows installed app/installer, and independent security signoff remain OPEN.

Repository PRIVATE, inherited Actions disabled, Draft/unmerged. Release NO-GO.
