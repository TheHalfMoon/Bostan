# B1-127 — Prevent bypasses in the agent Git remote-push safety scanner

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / DRAFT / UNMERGED / ZERO COST / RELEASE NO-GO**.
Direct parent B1-126 canonical private Draft PR #382 exact head `2037238b2a5bb7422e7882d256919b9e2998bf86`.

## Two real safety-policy detection gaps

Bostan's root `check:no-git-push` uses `scripts/check-no-git-push.mjs` to refuse `git push` inside adapter, server, and CLI execution source paths. It is a static guard, not a Git server-side permission mechanism.

**Gap 1 — Git global flags before the push subcommand.** The pre-B1-127 patterns detected `git push` and `spawn('git',['push', ...])`, but missed legitimate Git invocation syntaxes including:
- `execSync('git -C /tmp/work push origin main')`
- `spawn('git',['-C','/tmp/work','push','origin','main'])`
- `spawn('git',['-c','core.hooksPath=/tmp/hooks','push',...])`

These are valid remote-mutating commands. Model-side native Node v22.16.0 independently confirmed that the original matcher returned no offense on these representative examples (RED).

**Gap 2 — opt-in marker spoofing in source text.** The original code allowed any matching line or the preceding line to contain the substring `paperclip:allow-git-push`, even within a string literal or variable declaration. For example, a `const decoy = "paperclip:allow-git-push";` line immediately before a `git push` command silently removed that command from the scanner's offenses. This was reproduced with the actual old conditional and is not a valid operator-reviewed comment.

## Checked-in repair

**Tests first:** `scripts/check-no-git-push.test.mjs` commits `68a47e8941fde0773ddfd565fc0de927d75dde1c` and `a5bb6a422bb99ec877493eeffdce44383414acaa`. Seven new source-native Node tests were authored, exercising shell Git global options, array-form Git global options, safe Git non-push commands, scanner `runCheck` integration, fake opt-in markers in preceding/same-line string literals, legitimate legacy comments, and URL-like text containing the marker. Existing tests remain.

**Implementation:** `scripts/check-no-git-push.mjs` commits `b1e38e72a9b30d61ab0b7e6d4ed575a0b26ca28e` and `53d4f30d6b5f79448f7daf0fc11105cd89d549db`:
- Add two narrowly scoped patterns to recognize `git push` following common `-C`, `-c`, `--git-dir`, and `--work-tree` Git global options in shell strings and array-form `spawn` / `execFile` invocations.
- Keep the existing first two regex patterns and the exported `GIT_PUSH_PATTERN` index for backwards compatibility.
- Require an opt-in marker to occur in an actual **`//` source comment** on the flagged command or immediately preceding line. The existing `stripLineComment` lexing heuristic distinguishes `//` inside string literals from real comments. A marker in a string, source identifier or ordinary URL no longer grants an exception.
- Use the Bostan-native `bostan:allow-git-push` marker for new opt-ins. Existing, deliberately commented `paperclip:allow-git-push` remains accepted as a legacy compatibility marker. Legal source copyright/license notices were not touched.
- No outbound pushes, git remote writes, package installations, runtime agent permission changes or external API requests are performed by this patch.

## Verified source identity and actual bounded tests

Private GitHub connector re-fetched both complete committed files at the final code SHA:
- `scripts/check-no-git-push.mjs` blob **`a2ee8abf2bb9d8cedc4d320d16ad803d66fac684`**
- `scripts/check-no-git-push.test.mjs` blob **`cbf10156a48c8c5627f1641fa9603d7528bbd80e`**

**Actually executed:** a V8 isolated JavaScript harness extracted the **exact pure `GIT_PUSH_PATTERNS`, line-comment handling, and `findGitPushOffenses` code from the complete private GitHub source file**, compiled just that side-effect-free source, and ran **28/28 assertions PASS**: 12 remote-push-positive examples, eight non-push negative cases, and eight string-spoofed/real-comment opt-in cases. It also successfully parsed the 30-test checked-in JavaScript test body without executing its Node file-system fixtures. Separately, native local Node v22.16.0 ran the old matcher against common Git -C/-c syntaxes, confirming the false negatives, and ran the original marker condition against two string-literal decoy cases confirming incorrect allowances.

**Not executed:** the entire checked-in `node --test scripts/check-no-git-push.test.mjs` Node file (the new seven tests were authored but not source-native run), the full adapter/server/CLI scanner across Bostan's private checked-out tree, B1-126 16-case Bash synthetic admission regression, actual four-suite Linux Vitest5/TypeScript7/bwrap integration or installed Windows/macOS/Linux product. No private full Bostan checkout, Node >=24.11, Vitest/TS7 and rootless bwrap are present in the model's isolated runner. Desktop Commander previously reported exhausted monthly quota and explicitly instructed not to retry/reconnect, so it was not called.

**Scope and residual risk:** This is a conservative, text-based static guard. Git supports other command encodings, shell wrappers, executable aliases and dynamic argument constructions; regex coverage cannot substitute for a runtime deny policy or Git credential restrictions. No claim of complete protection from all remote writes.

## Mandatory next release gates

On an authorized disposable owner-marked private QA checkout at this exact Draft head and with preinstalled requirements: run `node --test scripts/check-no-git-push.test.mjs`, `node scripts/check-no-git-push.mjs`, `node --test scripts/bostan-private-linux-vitest-report-audit.test.mjs`, `bash scripts/bostan-private-linux-sandbox-gate.test.sh` (all 16 expected cases), then genuine `bash scripts/bostan-private-linux-sandbox-gate.sh --run` with four required rootless bubblewrap cases, full Vitest and TS7. On installed Windows/macOS/Linux, validate governed side effects/consent and persistence, repeated real PostgreSQL stress #234, privacy/tenant security and donor licenses/NOTICE/provenance.

**Product release: NO-GO**. Preserve repo PRIVATE, all PRs Draft unmerged, main unchanged, GitHub Actions disabled, no publish/deploy/release/npm pack, paid providers, customer data, unowned cleanup or legally required upstream notice removal.
