#!/usr/bin/env bash
# Bostan B1-112 — Linux source-native sandbox QA. No downloads, writes or cleanup.
set -euo pipefail
umask 077

usage() {
  printf '%s\n' 'BOSTAN_B112_LINUX_SANDBOX_GATE' \
    'Usage: bash scripts/bostan-private-linux-sandbox-gate.sh [--plan | --run]' \
    'Default: --plan. --run requires an existing owner-marked QA checkout,' \
    'matching pinned code/test blobs, local dependencies, unprivileged bwrap,' \
    'and adequate memory/disk. No install, download, cleanup or publication.'
}

mode="--plan"
if [[ $# -gt 0 ]]; then mode="$1"; fi
if [[ $# -gt 1 || ( "$mode" != "--run" && "$mode" != "--plan" && "$mode" != "--help" ) ]]; then
  usage >&2
  exit 2
fi
usage
[[ "$mode" == "--help" || "$mode" == "--plan" ]] && exit 0

fail() { printf 'BOSTAN_B112_ADMISSION_REFUSED: %s\n' "$1" >&2; exit 1; }

# A release candidate must be tested from the actual repo, not from a copied
# script on some other checkout. The test runner is read-only at this layer;
# Vitest may still create its own test-only temporary files.
[[ "$(uname -s)" == "Linux" ]] || fail 'native Linux is required'
command -v git >/dev/null || fail 'git is missing'
root="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"
[[ "$(git -C "$root" rev-parse --show-toplevel 2>/dev/null)" == "$root" ]] || fail 'script must run inside its own repository root'
[[ -f "$root/.bostan-linux-qa-owned" ]] || fail 'QA ownership marker is missing'
[[ "$(cat "$root/.bostan-linux-qa-owned")" == 'BOSTAN_QA_OWNED' ]] || fail 'QA ownership marker mismatch'
remote="$(git -C "$root" remote get-url origin 2>/dev/null)" || fail 'origin remote is missing'
case "$remote" in
  'https://github.com/TheHalfMoon/Bostan'|'https://github.com/TheHalfMoon/Bostan.git'|'git@github.com:TheHalfMoon/Bostan.git') ;;
  *) fail 'origin must be the private Bostan repository without embedded credentials' ;;
esac
command -v node >/dev/null || fail 'node is missing'
[[ "$(node -p 'try { require(process.argv[1]).name } catch { "" }' "$root/package.json" 2>/dev/null)" == 'bostan' ]] || fail 'root package identity mismatch'

source_path='packages/adapter-utils/src/local-process-sandbox.ts'
test_path='packages/adapter-utils/src/local-process-sandbox.test.ts'
source_blob='8274f932aac8699b112d6e53d9189596e2a28059'
test_blob='d0d4b391fad3f5f10379c71e091f367b25299eb1'
[[ "$(git -C "$root" rev-parse "HEAD:$source_path" 2>/dev/null)" == "$source_blob" ]] || fail 'source blob differs from B1-111 pinned source'
[[ "$(git -C "$root" rev-parse "HEAD:$test_path" 2>/dev/null)" == "$test_blob" ]] || fail 'test blob differs from B1-111 pinned tests'
[[ -z "$(git -C "$root" status --porcelain -- "$source_path" "$test_path")" ]] || fail 'source or test has uncommitted modifications'
# Git status respects --assume-unchanged and --skip-worktree, so even a clean
# status can conceal altered working-tree bytes. Tests execute files on disk,
# not the Git object recorded at HEAD: pin BOTH independently, fail-closed.
[[ -f "$root/$source_path" && ! -L "$root/$source_path" ]] || fail 'source must be an ordinary checkout file'
[[ -f "$root/$test_path" && ! -L "$root/$test_path" ]] || fail 'test must be an ordinary checkout file'
# The leaf may be regular while an ancestor directory is a symlink into
# foreign storage. Check canonical paths as well as leaf types before tests.
command -v realpath >/dev/null || fail 'realpath is missing'
[[ "$(realpath -e -- "$root/$source_path" 2>/dev/null)" == "$root/$source_path" ]] || fail 'source resolves through a symlink or outside QA checkout'
[[ "$(realpath -e -- "$root/$test_path" 2>/dev/null)" == "$root/$test_path" ]] || fail 'test resolves through a symlink or outside QA checkout'
[[ "$(git -C "$root" hash-object -- "$root/$source_path" 2>/dev/null)" == "$source_blob" ]] || fail 'source working-tree bytes differ from pinned source'
[[ "$(git -C "$root" hash-object -- "$root/$test_path" 2>/dev/null)" == "$test_blob" ]] || fail 'test working-tree bytes differ from pinned tests'

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major>24 || (major===24 && minor>=11) ? 0 : 1)' || fail 'Node >=24.11 required'
[[ -x "$root/node_modules/.bin/vitest" ]] || fail 'installed local Vitest required (do not download)'
[[ -x "$root/node_modules/.bin/tsc" ]] || fail 'installed local TypeScript required (do not download)'
command -v bwrap >/dev/null || fail 'bwrap is missing (do not install automatically)'
command -v timeout >/dev/null || fail 'GNU timeout is missing'
[[ -r /proc/meminfo ]] || fail '/proc/meminfo missing'
mem_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
[[ "$mem_kb" =~ ^[0-9]+$ && "$mem_kb" -ge 2097152 ]] || fail 'less than 2 GiB available RAM'
disk_kb="$(df -Pk "$root" | awk 'END {print $4}')"
[[ "$disk_kb" =~ ^[0-9]+$ && "$disk_kb" -ge 2097152 ]] || fail 'less than 2 GiB free QA disk'

# Reject kernels that cannot establish an unprivileged network namespace.
# Never add --privileged or alter machine-wide namespace settings to pass.
timeout 15s bwrap --die-with-parent --unshare-net --ro-bind / / -- /usr/bin/true \
  || fail 'unprivileged bwrap namespace probe failed'

cd "$root"
printf 'BOSTAN_B112_SOURCE_SHA=%s\n' "$(git rev-parse HEAD)"
printf 'BOSTAN_B112_BWRAP_PROBE=PASS\n'
printf 'BOSTAN_B112_FOUR_TEST_SUITES_BEGIN\n'
timeout 360s ./node_modules/.bin/vitest run \
  packages/adapter-utils/src/local-process-sandbox.test.ts \
  packages/adapter-utils/src/execution-target-sandbox.test.ts \
  packages/adapter-utils/src/paperclip-runner-permissions.test.ts \
  packages/adapter-utils/src/sandbox-install-command.test.ts \
  --pool=forks --maxWorkers=1 --testTimeout=15000 --hookTimeout=15000 \
  --reporter=dot --silent || fail 'actual source-native Linux Vitest is NOT green'
printf 'BOSTAN_B112_FOUR_TEST_SUITES=PASS\n'
printf 'BOSTAN_B112_PACKAGE_TYPECHECK_BEGIN\n'
timeout 180s ./node_modules/.bin/tsc --project packages/adapter-utils/tsconfig.json --noEmit \
  || fail 'actual source-native adapter-utils TypeScript is NOT green'
printf 'BOSTAN_B112_PACKAGE_TYPECHECK=PASS\n'
printf 'BOSTAN_B112_LINUX_GATE_PASS\n'
