# B0-60 — Private Bostan CLI acceptance across macOS, native Windows and Linux

**2026-10-27.** Private stacked Draft above B0-59 PR #208 at `3f957776ddb3fba69e77d672b3936b92e438f26d`. Do **not** publish, merge into `main`, deploy, enable inherited GitHub Actions, call paid providers, or use customer data. Product release remains **NO-GO**.

## Why this change

B0-49 (PR #198) ran native Windows CLI safety tests and a Mac regression but explicitly left the Linux CLI preview **untested**. Earlier projects also relied on running Node tests manually, without a consistent explicit, opt-in command across operating systems. This change adds `scripts/bostan-private-cli-platform-acceptance.mjs` with **read-only by default** (`--plan`) and `--run` to build the Bostan preview and run exactly three existing private CLI safety suites. It rejects unknown arguments and checks the private root / native Bostan CLI manifest. It scrubs model/telemetry/DB keys before subprocesses and asks npm to remain offline.

The script enforces the repository's existing Node.js engine requirement **>=24.11.0**, including the built-in TypeScript loader required by `ui/src/lib/zip.ts`. This is especially material on Ubuntu where the distribution's Node 22 build may not have TypeScript support. This is **not** a new product engine requirement.

## Actual independent platform evidence

The same original three CLI safety suites were run on a pinned B0-59 base at `3f95777`:

| Environment | Native runtime | PASS | FAIL | SKIP | Real coverage |
| --- | --- | ---: | ---: | ---: | --- |
| macOS arm64 `macbook` | Node v26.0.0 | 25 | 0 | 1 | Isolated local preview install, post-stage execution, ZIP inspection/integrity, reject tampering/symlinks, public/legacy operations blocked |
| Windows 11 `Abdulaziz` | Node v24.19.0 | 13 | 0 | 13 | Real Windows refusals, local ZIP parser, read-only status and file safety. 12 native installation scenarios and 1 symlink-negative are deliberately skipped |
| WSL2 Ubuntu x86_64 `Abdulaziz` | Official free Linux Node v24.19.0 | 25 | 0 | 1 | Actual **Linux-native CLI preview install and execution** from WSL's own filesystem, ZIP inspection/integrity, symlink/path safety, post-staging survival, no remote provider |

The Ubuntu distribution's pre-installed Node v22.22.1 failed to import `.ts` in both ZIP and CLI installation suites (`ERR_UNKNOWN_FILE_EXTENSION`). Repeating with `--experimental-strip-types` also failed (`ERR_NO_TYPESCRIPT`) because that distro Node build lacks the required support. These exploratory failures are recorded and **not counted as passes**. A free official Linux Node v24.19.0 binary was downloaded to the temporary Linux test root; rerun returned **25 PASS, 0 FAIL, 1 SKIP** (the Windows-only safety scenario).

The WSL filesystem reports large virtual capacity, **not** proof of corresponding host physical capacity. The Windows host actually had approximately **3.06 GiB free C:**, **8.55 GiB free D:** and **2.45 GiB free RAM**, so a full native installed Windows GUI/server/runner acceptance was **not** attempted. A sparse, 8.6 MiB source checkout on D: was used, without installing the full node_modules closure. The Linux test copy used the authorized WSL instance with local synthetic fixtures.

## New reproducible command

```sh
node scripts/bostan-private-cli-platform-acceptance.mjs --plan
node scripts/bostan-private-cli-platform-acceptance.mjs --run
node --test scripts/bostan-private-cli-platform-acceptance.test.mjs
```

### B0-60 wrapper branch verification (commit `66f9918`)

- **macOS arm64:** wrapper unit tests **2/2 PASS**; `--run` **25 PASS, 1 SKIP, 0 FAIL**, explicit `BOSTAN_PRIVATE_CLI_PLATFORM_ACCEPTANCE_PASS`, exit 0.
- **Native Windows 11:** independently checked out the **exact `66f9918` B0-60 branch** on D:. Unit tests **2/2 PASS**; `--run` **13 PASS, 13 SKIP, 0 FAIL**, native Windows refusal tested, acceptance marker emitted, exit 0. The skips remain unqualified native installer/symlink cases.
- **Ubuntu WSL2 Linux x86_64:** unpacked the **same branch's exact sparse source archive** into WSL Linux filesystem and used official free Node v24.19.0. Unit tests **2/2 PASS**; `--run` **25 PASS, 1 SKIP, 0 FAIL**, native Linux CLI installed path exercised, acceptance marker emitted, exit 0.
- No GitHub Actions were enabled; no deployment, model provider, real user, or release process was invoked.

The final note update changes only this evidence document. The previously executed wrapper and test source is unchanged.

## Limits and follow-up

This closes **Linux CLI preview acceptance**, not full product readiness. There is no Linux desktop installer, full server/UI+PostgreSQL+native Rust/agent qualification, email delivery, real free-model governed task reliability, Windows installed lifecycle or independent security/license review in this evidence. Existing versioned wire identifiers and legally required notices are preserved. Repository stays private; Actions off; PR remains Draft and unmerged.
