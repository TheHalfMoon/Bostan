# B0-67 — Bind CLI acceptance to 48-package private registry quarantine, qualify 3 operating systems

**2026-10-27.** Private stacked Draft after B0-66 PR #215 (base `4c4df682749ce4e26bfe5930c6e7fd97eed159ff`). Repository PRIVATE, GitHub Actions OFF, no merge into `main`, no publication, no deployment, no paid inference or real customer data.

## Risk being closed

B0-60 supplied a safe local CLI platform acceptance wrapper, and B0-65/66 introduced a separate no-network gate that checks **48 git-tracked package manifests** (including nested test fixtures) for `private:true`, Bostan-owned names and absence of public `publishConfig`. However, these gates were independent: the CLI could pass and show a green Bostan platform acceptance marker even if another package in the source checkout regressed to public registry publication eligibility.

The B0-67 change binds the two gates: `verifyPrivateSource()` now checks the *entire* workspace via `verifyBostanPrivateWorkspace` **before** the CLI preview is built or any of the local installation tests run. A missing, unsuccessful or incomplete inventory (fewer than 48 tracked manifests) now aborts private CLI acceptance.

The existing private manifest, Node >=24.11.0, provider credential scrubbing, local-only tests, safe read-only default, published-command refusal, existing test suite selection and CLI runtime behavior remain unchanged.

## Regression prevention

Added a pure injected inspector seam for the wrapper unit test (runtime defaults to the real all-package inspector), including explicit refusals for: failed quarantine, accidentally enabled registry publication, insufficient manifest inventory. Tested that the injected inspector is called with the exact actual checkout root, not a hardcoded platform-dependent path.

### Exploratory Windows failure and correction

The first new unit test used a lowercase literal expected source directory. It **failed on native Windows**, whose actual checkout began with uppercase `D:\\Bostan-b067...`. Corrected the assertion to compare the source root with the URL-derived canonical checkout path using `fileURLToPath(new URL('../', import.meta.url))`. The corrected test was **rerun on Mac, Windows and Linux**. This was a nonportable *test assertion*, not evidence that production CLI installation failed.

## Actual evidence on exact corrected head `35a4c10`

| OS / device | Native Node.js | Unit checks (CLI guard + all-package source gate) | Real private CLI tests | Exits |
|---|---|---|---|---|
| macOS arm64 / macbook | v26.0.0 | **7 PASS**, 0 fail | **25 PASS**, 0 fail, 1 Windows-only skip | 0 |
| Windows 11 native / Abdulaziz | v24.19.0 | **7 PASS**, 0 fail | **13 PASS**, 0 fail, **13 skips** (12 native install/symlink scenarios and 1 related unsupported path) | 0 |
| Ubuntu Linux x86_64 WSL2 / Abdulaziz | Official Linux v24.19.0 | **7 PASS**, 0 fail | **25 PASS**, 0 fail, 1 Windows-only skip | 0 |

Additional focused Mac package inventory/release suite on the corrected head: **26 PASS, 0 fail** (4 files). A broader 23/23 registry/identity/release suite was separately verified on the parent B0-66 head across Mac, native Windows and Linux, before this scoped CLI coupling change.

All three corrected-head acceptance runs emitted exactly `BOSTAN_PRIVATE_CLI_PLATFORM_ACCEPTANCE_PASS`. The existing B0-60 tests perform genuine isolated **macOS/Linux local CLI preview installation and subsequent command execution**, ZIP path traversal/symlink/tampering refusal, provenance/integrity inspection and disabled inherited publish operations. Native Windows verified the enforced **refusal** of still-unqualified native installation, not installed Windows UI/CLI delivery.

The WSL distro's system Node v22.22.1 is *not* qualifying: a free official Linux Node 24.19.0 binary was obtained for the test. An initial location under the volatile WSL `/tmp` vanished after the distro exited. The final successful run used a separate **temporary D: QA Node binary**, not a Windows Node executable. Test source clone was on D:; Windows C: space was deliberately not consumed by installing this large project or local AI weights.

## Reproduction

```sh
node scripts/bostan-private-workspace-registry-gate.mjs --check
node --test scripts/bostan-private-cli-platform-acceptance.test.mjs scripts/bostan-private-workspace-registry-gate.test.mjs
node scripts/bostan-private-cli-platform-acceptance.mjs --run
```

No `npm publish`, `pnpm publish`, `gh release create`, public hosting, paid provider credentials, real user data, or remote model was used. The official Node distribution download is not an AI-model inference call.

## Limits / release decision

Cross-platform **CLI preview safety** is qualified on this exact head. The full installed Windows application/desktop UI remains **unqualified**, and the full Linux native compiled server/GUI/PostgreSQL/runner lifecycle is **not covered** by the CLI-specific gate. Third-party license notices, bundled binary origin, real governed free-model task outcomes, multi-host security review and release checks remain open. **Bostan release NO-GO.** Keep all PRs Draft/unmerged.
