#!/usr/bin/env bash
# B1-114: verify Linux gate rejects hidden worktree changes without external access.
set -euo pipefail
umask 077

if [[ "$(uname -s)" != Linux ]]; then
  printf 'BOSTAN_B114_TEST_REQUIRES_LINUX\n' >&2
  exit 2
fi
command -v git >/dev/null || { echo 'git required' >&2; exit 2; }
command -v node >/dev/null || { echo 'node required' >&2; exit 2; }

origin="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"
gate="$origin/scripts/bostan-private-linux-sandbox-gate.sh"
[[ -f "$gate" ]] || { echo 'actual Bostan Linux gate missing' >&2; exit 2; }

scratch="$(mktemp -d "${TMPDIR:-/tmp}/bostan-b114-owned-git-XXXXXX")"
[[ -d "$scratch" ]] || exit 2
cleanup() { [[ -n "$scratch" && -d "$scratch" ]] && rm -rf -- "$scratch"; }
trap cleanup EXIT

fixture="$scratch/repo"
mkdir -p "$fixture/scripts" "$fixture/packages/adapter-utils/src"
cp -- "$gate" "$fixture/scripts/bostan-private-linux-sandbox-gate.sh"
# B1-124 audit files are themselves HEAD/worktree-pinned by the real gate.
# Copy real checked-in files into this owned synthetic repository so the
# existing clean-checkout fixture reaches the later Node/dependency refusal.
for item in bostan-private-linux-vitest-report-audit.mjs bostan-private-linux-vitest-report-audit.test.mjs; do
  cp -- "$origin/scripts/$item" "$fixture/scripts/$item"
done
src='packages/adapter-utils/src/local-process-sandbox.ts'
test='packages/adapter-utils/src/local-process-sandbox.test.ts'
printf '%s\n' 'export const syntheticSource = "pinned";' > "$fixture/$src"
printf '%s\n' 'export const syntheticTest = "pinned";' > "$fixture/$test"
printf '%s\n' '{"name":"bostan","private":true}' > "$fixture/package.json"
printf '%s\n' 'BOSTAN_QA_OWNED' > "$fixture/.bostan-linux-qa-owned"
git -C "$fixture" init -q
git -C "$fixture" config user.name 'Bostan QA Synthetic'
git -C "$fixture" config user.email 'synthetic-qa@example.invalid'
git -C "$fixture" remote add origin 'https://github.com/TheHalfMoon/Bostan.git'
source_sha="$(git -C "$fixture" hash-object -- "$fixture/$src")"
test_sha="$(git -C "$fixture" hash-object -- "$fixture/$test")"
# These substitutions affect ONLY the throwaway fixture, never the true gate.
sed -i -E "s/^source_blob='[^']+'/source_blob='$source_sha'/" "$fixture/scripts/bostan-private-linux-sandbox-gate.sh"
sed -i -E "s/^test_blob='[^']+'/test_blob='$test_sha'/" "$fixture/scripts/bostan-private-linux-sandbox-gate.sh"
git -C "$fixture" add .
git -C "$fixture" commit -qm synthetic-base

refuse() {
  local case_name="$1" expected="$2" output
  if output="$(bash "$fixture/scripts/bostan-private-linux-sandbox-gate.sh" --run 2>&1)"; then
    printf 'B114_FAIL_UNEXPECTED_GATE_PASS: %s\n' "$case_name" >&2
    exit 1
  fi
  if ! grep -Fq -- "$expected" <<< "$output"; then
    printf 'B114_FAIL_WRONG_REFUSAL: %s expected=[%s]\noutput:\n%s\n' "$case_name" "$expected" "$output" >&2
    exit 1
  fi
  printf 'B114_PASS: %s\n' "$case_name"
}

# Clean synthetic checkout must reach the *later* runtime requirement rather
# than failing either of the source/test content-hash checks.
if clean_output="$(bash "$fixture/scripts/bostan-private-linux-sandbox-gate.sh" --run 2>&1)"; then
  echo 'B114_FAIL: synthetic checkout unexpectedly ran full gate' >&2
  exit 1
fi
if ! grep -Eq 'Node >=24.11 required|installed local Vitest required' <<< "$clean_output"; then
  printf 'B114_FAIL: clean checkout denied early:\n%s\n' "$clean_output" >&2
  exit 1
fi
printf 'B114_PASS: clean pinned fixture passed content checks\n'

for flag in assume-unchanged skip-worktree; do
  for target in "$src" "$test"; do
    git -C "$fixture" update-index --"$flag" -- "$target"
    printf '%s\n' '// SYNTHETIC TAMPER AFTER COMMIT' >> "$fixture/$target"
    hidden="$(git -C "$fixture" status --porcelain -- "$target")"
    [[ -z "$hidden" ]] || { echo "B114_FAIL: Git $flag did not hide local change in fixture" >&2; exit 1; }
    case "$target" in
      "$src") expected='source working-tree bytes differ from pinned source' ;;
      *) expected='test working-tree bytes differ from pinned tests' ;;
    esac
    refuse "$flag / $target" "$expected"
    git -C "$fixture" update-index --no-"$flag" -- "$target"
    git -C "$fixture" restore --worktree -- "$target"
  done
done

# A symlink to byte-identical content must not replace a pinned ordinary file.
git -C "$fixture" update-index --assume-unchanged -- "$src"
cp -- "$fixture/$src" "$scratch/owned-external-source.ts"
rm -- "$fixture/$src"
ln -s -- "$scratch/owned-external-source.ts" "$fixture/$src"
refuse 'replaced source by symlink' 'source must be an ordinary checkout file'
rm -- "$fixture/$src"
git -C "$fixture" update-index --no-assume-unchanged -- "$src"
git -C "$fixture" restore --worktree -- "$src"

# New B1-124 verifier inputs must also fail closed if Git hides a changed
# auditor or its own test file; do not relax the audit to make this pass.
for item in bostan-private-linux-vitest-report-audit.mjs bostan-private-linux-vitest-report-audit.test.mjs; do
  qa_path="scripts/$item"
  git -C "$fixture" update-index --assume-unchanged -- "$qa_path"
  printf '%s\n' '// OWNED SYNTHETIC AUDITOR TAMPER' >> "$fixture/$qa_path"
  [[ -z "$(git -C "$fixture" status --porcelain -- "$qa_path")" ]] || {
    echo "B124_FAIL: hidden audit modification unexpectedly visible" >&2
    exit 1
  }
  refuse "hidden B1-124 QA auditor: $item" 'QA report auditor worktree differs from pinned source'
  git -C "$fixture" update-index --no-assume-unchanged -- "$qa_path"
  git -C "$fixture" restore --worktree -- "$qa_path"
done

# A symlinked ancestor can redirect both ordinary leaf files to a foreign
# directory while Git's skip-worktree bits conceal the checkout replacement.
git -C "$fixture" update-index --skip-worktree -- "$src" "$test"
mkdir -p "$scratch/owned-external-tree/adapter-utils/src"
cp -- "$fixture/$src" "$scratch/owned-external-tree/adapter-utils/src/"
cp -- "$fixture/$test" "$scratch/owned-external-tree/adapter-utils/src/"
mv -- "$fixture/packages" "$scratch/owned-original-packages"
ln -s -- "$scratch/owned-external-tree" "$fixture/packages"
[[ -f "$fixture/$src" && ! -L "$fixture/$src" ]] || { echo 'B116_FAIL: source leaf is not regular' >&2; exit 1; }
[[ -f "$fixture/$test" && ! -L "$fixture/$test" ]] || { echo 'B116_FAIL: test leaf is not regular' >&2; exit 1; }
[[ -z "$(git -C "$fixture" status --porcelain -- "$src" "$test")" ]] || { echo 'B116_FAIL: parent symlink not hidden by Git' >&2; exit 1; }
refuse 'symlinked ancestor directory' 'source resolves through a symlink or outside QA checkout'

printf 'BOSTAN_B116_REGRESSION=PASS (7 bounded cases, synthetic only)\n'
printf 'BOSTAN_B124_AUDITOR_INTEGRITY=PASS (2 added, 9 total synthetic cases)\n'
