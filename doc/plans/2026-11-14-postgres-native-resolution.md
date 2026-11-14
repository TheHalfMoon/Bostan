# Resolve deployed embedded PostgreSQL native dependencies

The database package owns native library preparation. Desktop run43540750436
at9b25054d finished15non-desktopPASS/2desktopFAIL. macOS reported the approved
server:420:31 startup site and POSTGRES_LIBRARY_MISSING; Windows still exceeded
the120second NSIS deadline. Solid compression did not establish installation
acceptance. Neither native platform is qualified.

The exact retained macOS DMG, SBOM and license inventory passed their manifests'
SHA256 verification. Its HFS inventory shows a real nested
@bostan/db/node_modules/embedded-postgres directory, while the native dependency
is reached through the virtual store's hoisted package links. The old native
preparation helper guesses a sibling of that nested copy and returns without
preparing aliases when the guessed directory is absent.

Resolve the platform-native package using createRequire from the embedded
dependency's own entry, matching Node's actual package lookup. Existing platform
selection, same-package alias policy and missing-optional-package behavior stay
unchanged. There are no downloads, new dependencies, cross-major links, external
library search paths, data migrations or new log disclosures.

The pinned Darwin ARM64 registry archive passed its SHA512 integrity check.
Read-only Mach-O inspection covered22binaries/libraries: the initialization
dependency chain is present after existing aliases. A separate libpq OAuth module
references an absent libcurl; that is outside the observed initialization chain
and remains an unqualified native capability, not silently repaired here.
No macOS binary or installer was executed on the operator's Windows machine.
The official standalone7zip26.06 inspector was extracted without installation;
its archive SHA256 matched the Microsoft winget manifest.

The regression constructs the deployed nested .pnpm workspace layout, a hoisted
native package and real directory junction/symlink. Actual Node resolution finds
the correct physical package and bytes, while the old guessed directory is
absent; an unavailable native package returns null. Focused regression1PASS,
6other tests filtered. Full local Windows suite3PASS/2FAIL/2Linux-only skips:
the existing macOS alias tests cannot create file symlinks (EPERM). These tests
and their assertions remain intact. The initial regression also tried to create
aliases; it was narrowed to the actual resolution boundary already separate
from alias coverage, without changing existing alias tests.

Independent correctness/parsimony/product review passed. Exact-head source CI
and native installed macOS rerun remain required. This repairs a demonstrated
lookup defect; it does not prove the installed app now starts or qualify Windows.
