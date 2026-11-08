#!/usr/bin/env bash
# Bostan B1-124 — Linux source-native sandbox QA; no downloads/installs.
# --run creates only an owned temporary Vitest JSON report, then deletes it.
set -euo pipefail
umask 077

usage() {
  printf '%s\n' 'BOSTAN_B112_LINUX_SANDBOX_GATE' \
    'Usage: bash scripts/bostan-private-linux-sandbox-gate.sh [--plan | --run]' \
    'Default: --plan. --run requires an existing owner-marked QA checkout,' \
    'matching pinned code/test blobs, local dependencies, unprivileged bwrap,' \
    'and adequate memory/disk. One owned JSON report is removed after QA.'
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
source_blob='d4e4edba99cb0ec5db5ffcff47c0eedc404470c3'
test_blob='f04ef1809e58626aa9f9a34da49b2ba7d5c5af1b'
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

# The JSON audit itself decides whether rootless integration cases actually
# executed. Pin its checked-in source and regression tests as strictly as the
# production files; never execute a modified report verifier.
audit_path='scripts/bostan-private-linux-vitest-report-audit.mjs'
audit_test_path='scripts/bostan-private-linux-vitest-report-audit.test.mjs'
audit_blob='b361b8563e1ab288c9f81710993a432e87866274'
audit_test_blob='66396962359d57d0c16df2bac04d87ee2080a58e'
for pair in "$audit_path:$audit_blob" "$audit_test_path:$audit_test_blob"; do
  qa_path="${pair%%:*}"
  qa_blob="${pair#*:}"
  [[ "$(git -C "$root" rev-parse "HEAD:$qa_path" 2>/dev/null)" == "$qa_blob" ]] || fail 'QA report auditor blob differs from pinned identity'
  [[ -z "$(git -C "$root" status --porcelain -- "$qa_path")" ]] || fail 'QA report auditor contains uncommitted modifications'
  [[ -f "$root/$qa_path" && ! -L "$root/$qa_path" ]] || fail 'QA report auditor must be an ordinary file'
  [[ "$(realpath -e -- "$root/$qa_path" 2>/dev/null)" == "$root/$qa_path" ]] || fail 'QA report auditor resolves through symlink or outside checkout'
  [[ "$(git -C "$root" hash-object -- "$root/$qa_path" 2>/dev/null)" == "$qa_blob" ]] || fail 'QA report auditor worktree differs from pinned source'
done


# The other three selected Vitest suites were previously unpinned. Git can
# conceal changes to them with --skip-worktree/--assume-unchanged, so an
# altered/no-op test suite could still be reported as green. Bind all four
# actual suite files to their reviewed HEAD and on-disk Git blob identities.
for pair in \
  'packages/adapter-utils/src/execution-target-sandbox.test.ts:377be29a853dc9189a280c62cc8177248281d220' \
  'packages/adapter-utils/src/paperclip-runner-permissions.test.ts:fcaeea10fca499b98543a218f502809fde44fb48' \
  'packages/adapter-utils/src/sandbox-install-command.test.ts:882634137621026b645e8f77d6e4355a571717ba'; do
  suite_path="${pair%%:*}"
  suite_blob="${pair#*:}"
  [[ "$(git -C "$root" rev-parse "HEAD:$suite_path" 2>/dev/null)" == "$suite_blob" ]] || fail 'additional suite HEAD differs from pinned identity'
  [[ -z "$(git -C "$root" status --porcelain -- "$suite_path")" ]] || fail 'additional suite has uncommitted modifications'
  [[ -f "$root/$suite_path" && ! -L "$root/$suite_path" ]] || fail 'additional suite must be an ordinary checkout file'
  [[ "$(realpath -e -- "$root/$suite_path" 2>/dev/null)" == "$root/$suite_path" ]] || fail 'additional suite resolves through symlink or outside checkout'
  [[ "$(git -C "$root" hash-object -- "$root/$suite_path" 2>/dev/null)" == "$suite_blob" ]] || fail 'additional suite working-tree bytes differ from pinned source'
done

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major>24 || (major===24 && minor>=11) ? 0 : 1)' || fail 'Node >=24.11 required'
[[ -x "$root/node_modules/.bin/vitest" ]] || fail 'installed local Vitest required (do not download)'
[[ -x "$root/node_modules/.bin/tsc" ]] || fail 'installed local TypeScript required (do not download)'
command -v bwrap >/dev/null || fail 'bwrap is missing (do not install automatically)'
bwrap_path="$(command -v bwrap)"
[[ "$bwrap_path" == /* && -x "$bwrap_path" ]] || fail 'bwrap must resolve to an existing executable path'
command -v timeout >/dev/null || fail 'GNU timeout is missing'
command -v mktemp >/dev/null || fail 'mktemp is missing'
[[ -r /proc/meminfo ]] || fail '/proc/meminfo missing'
mem_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
[[ "$mem_kb" =~ ^[0-9]+$ && "$mem_kb" -ge 2097152 ]] || fail 'less than 2 GiB available RAM'
disk_kb="$(df -Pk "$root" | awk 'END {print $4}')"
[[ "$disk_kb" =~ ^[0-9]+$ && "$disk_kb" -ge 2097152 ]] || fail 'less than 2 GiB free QA disk'

# Reject kernels that cannot establish an unprivileged network namespace.
# Never add --privileged or alter machine-wide namespace settings to pass.
timeout 15s "$bwrap_path" --die-with-parent --unshare-net --ro-bind / / -- /usr/bin/true \
  || fail 'unprivileged bwrap namespace probe failed'

cd "$root"
printf 'BOSTAN_B112_SOURCE_SHA=%s\n' "$(git rev-parse HEAD)"
printf 'BOSTAN_B112_BWRAP_PROBE=PASS\n'
# Run the native result-audit regression before trusting any JSON success.
timeout 20s node --test "$root/$audit_test_path" || fail 'native JSON audit regression is NOT green'
report_file="$(mktemp "${TMPDIR:-/tmp}/bostan-b124-owned-vitest-XXXXXXXX.json")" || fail 'cannot create owned JSON report'
cleanup_report() {
  [[ -n "${report_file:-}" && -f "$report_file" ]] && rm -f -- "$report_file"
}
trap cleanup_report EXIT

printf 'BOSTAN_B112_FOUR_TEST_SUITES_BEGIN\n'
# Without these flags, the crucial real-bwrap suites use it.runIf(false)
# and Vitest may return exit 0 despite performing ZERO rootless tests.
# The TypeScript build inside bwrap is distinct from the ordinary tsc below.
timeout 600s env BOSTAN_TEST_BWRAP="$bwrap_path" BOSTAN_TEST_SANDBOX_BUILD=1 \
  ./node_modules/.bin/vitest run \
  packages/adapter-utils/src/local-process-sandbox.test.ts \
  packages/adapter-utils/src/execution-target-sandbox.test.ts \
  packages/adapter-utils/src/paperclip-runner-permissions.test.ts \
  packages/adapter-utils/src/sandbox-install-command.test.ts \
  --pool=forks --maxWorkers=1 --testTimeout=90000 --hookTimeout=15000 \
  --reporter=json --outputFile="$report_file" --silent \
  || fail 'actual source-native Linux Vitest is NOT green'
[[ -s "$report_file" ]] || fail 'Vitest JSON report absent or empty'
audit_output="$(node "$root/$audit_path" "$report_file")" || fail 'rootless bubblewrap cases were skipped, failed or absent'
# Do not trust exit code alone. A CLI guard regression can exit zero without
# executing the auditor; only its two exact PASS lines establish attestation.
expected_audit_output="$(printf 'BOSTAN_B124_VERIFIED_SUITES=4\nBOSTAN_B124_VERIFIED_ROOTLESS_CASES=4')"
[[ "$audit_output" == "$expected_audit_output" ]] || fail 'rootless bubblewrap JSON audit did not provide exact success evidence'
printf '%s\n' "$audit_output"
printf 'BOSTAN_B112_FOUR_TEST_SUITES=PASS\n'
printf 'BOSTAN_B112_PACKAGE_TYPECHECK_BEGIN\n'
timeout 180s ./node_modules/.bin/tsc --project packages/adapter-utils/tsconfig.json --noEmit \
  || fail 'actual source-native adapter-utils TypeScript is NOT green'
printf 'BOSTAN_B112_PACKAGE_TYPECHECK=PASS\n'
printf 'BOSTAN_B112_LINUX_GATE_PASS\n'
