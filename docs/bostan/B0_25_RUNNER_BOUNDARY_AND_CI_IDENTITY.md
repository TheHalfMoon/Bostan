# B0-25 — Runner isolation, Bostan eval link and CI identity

Private, unpublished Bostan source-only engineering, 2026-10-26. This wave stacks after B0-24 Draft PR #173. Keep all PRs Draft; never merge `main`, publish/deploy, turn on inherited Actions or incur paid API/model costs. Original third-party attribution and versioned wire schema contracts remain intact.

## Isolation defect fixed without widening the allowlist

The standalone Runner forbids source-relative imports escaping the package. Its package-wide guard previously failed on three pre-existing external source imports. Moved the **single actual implementations** into Runner-owned `scripts/ci-profile-record.mjs`, `scripts/dev-runner-native-binary.mjs` and `scripts/native-completion-git-source.mjs`, and updated package-local import consumers. Root-level old paths are only backwards-compatible re-exports, so existing scripts/CI/fixtures still resolve; no duplicated security logic or weakened import exception. The standalone import-boundary suite now passes **14/14** (was 13/14), including adversarial imports and both `@bostan/` and legacy namespace checks.

Native completion's source allowlist and definition digest now include the relocated security-sensitive implementation, preventing an unpinned implementation from changing attested behavior. Its source-contract suite is green.

## Actual Bostan namespace fixes

- Repaired `pnpm-lock.yaml` Runner importer: `@bostan/eval-kernel` now points to `link:../bostan-eval-kernel`, not the removed inherited path. `pnpm install --offline --frozen-lockfile --ignore-scripts` relinked the package correctly. Strengthened Runner package-boundary check to catch any future stale Bostan lockfile link, non-private kernel or misplaced runtime dependency.
- Included the existing `@bostan/teams-catalog` Vitest project in stable workspace lanes and replaced old root CLI name with `bostan`. Updated server shard fixtures to the actual `@bostan/server` Vitest project. This fixes four inherited test failures without disabling or skipping test cases.

## Verification on Mac (source only)

- Runner `scripts/check-forbidden-imports.test.mjs`: **14 PASS / 0 FAIL**; standalone check CLI PASS.
- Bostan Runner package-boundary script: PASS, including frozen lockfile target and namespace restrictions.
- Runner official `typecheck:typescript`: PASS with TypeScript **7.0.2**, including its strict TS/surfaces checks, protocol, ACPX profile/schema checks and native Eval Kernel build. This also detects and resolves the real stale package link that previously caused TS2307. Full Rust typecheck **not run** in this wave.
- Native completion Git-source/provenance unit suite: **36 PASS / 0 FAIL**. Runner binary stage and publication suite: **7 PASS / 0 FAIL**.
- Native completion source contract plus Vitest workspace/shard unit suites: **61 PASS / 0 FAIL** (previously 57/61).
- `@bostan/eval-kernel` TypeScript build PASS; `pnpm install` with `--frozen-lockfile` PASS; `git diff --check` PASS. All tests use deterministic local fixtures; no paid inference. Free npm registry package download was necessary on initial setup because offline cache lacked 101 tarballs; later frozen offline relink PASS.

## Still blocked

The full official server production build, installed Windows application and UI qualification, independent model-authored signed Case, comprehensive security signoff, inherited ACPX cases and remaining first-party package rename waves remain open. This wave makes no general availability or release-readiness claim. **Release NO-GO.**
