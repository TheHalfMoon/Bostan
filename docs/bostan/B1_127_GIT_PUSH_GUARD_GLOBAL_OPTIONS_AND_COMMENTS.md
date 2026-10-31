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

**Tests first:** `scripts/check-no-git-push.test.mjs` commits `68a47e8941fde0773ddfd565fc0de927d75dde1c` , `a5bb6a422bb99ec877493eeffdce44383414acaa`, and `8fec4302bf79230ea0fb872b07998268b620982b`. Eight new source-native Node tests were authored, exercising shell Git global options, array-form Git global options, safe Git non-push commands, scanner `runCheck` integration, fake opt-in markers in preceding/same-line string literals, legitimate legacy comments, and URL-like text containing the marker. Existing tests remain.

**Implementation:** `scripts/check-no-git-push.mjs` commits `b1e38e72a9b30d61ab0b7e6d4ed575a0b26ca28e` , `53d4f30d6b5f79448f7daf0fc11105cd89d549db`, and `74a8d341f8b5faf72242621c1619c887bb9d20d6`:
- Add two narrowly scoped patterns to recognize `git push` following common `-C`, `-c`, `--git-dir`, and `--work-tree` Git global options in shell strings and array-form `spawn` / `execFile` invocations.
- Keep the existing first two regex patterns and the exported `GIT_PUSH_PATTERN` index for backwards compatibility.
- Require an opt-in marker to occur in an actual **`//` source comment** on the flagged command or immediately preceding line. The existing `stripLineComment` lexing heuristic distinguishes `//` inside string literals from real comments. A marker in a string, source identifier or ordinary URL no longer grants an exception. The matcher now masks the marker token itself during pattern recognition, avoiding false-positive offenses from the literal substring `git-push` in the opt-in identifier while continuing to detect real commands on the same line.
- Use the Bostan-native `bostan:allow-git-push` marker for new opt-ins. Existing, deliberately commented `paperclip:allow-git-push` remains accepted as a legacy compatibility marker. Legal source copyright/license notices were not touched.
- No outbound pushes, git remote writes, package installations, runtime agent permission changes or external API requests are performed by this patch.

## Verified source identity and actual bounded tests

Private GitHub connector re-fetched both complete committed files at the final code SHA:
- `scripts/check-no-git-push.mjs` blob **`4158b1b997fdfaeb8cccc355c70900966480a38e`**
- `scripts/check-no-git-push.test.mjs` blob **`21724c13f0967ed2448bdd95778e7ca9c5ed8273`**

**Actually executed — pure-source focused checks:** a V8 isolated JavaScript harness extracted the exact pure `GIT_PUSH_PATTERNS`, line-comment handling, and `findGitPushOffenses` code from the private GitHub source, compiled that side-effect-free code, and ran **28/28 assertions PASS**: 12 positive remote-push cases, eight allowed non-push cases, and eight explicit opt-in/comment cases. Separately, native Node22 reproduced the pre-fix global-option false negatives and string-literal marker bypass.

**Actually executed — exact checked-in Node test file:** the model's own isolated Linux directory was populated with the two committed private GitHub file contents, recovered through a compressed byte-preserving transfer and independently verified with `git hash-object` to their exact repository blob SHAs. The initial real `node --test scripts/check-no-git-push.test.mjs` run found **18 PASS / 3 FAIL of 21 tests**. The three failures were genuine false-positive offenses: the original regex saw `git-push` *inside the Bostan and legacy marker identifiers* and counted the marker string itself as an additional Git push command. The implementation was amended at `74a8d341f8b5faf72242621c1619c887bb9d20d6` to mask only reviewed-marker tokens during push detection; an additional test at `8fec4302bf79230ea0fb872b07998268b620982b` covers marker-only source strings. The two **updated** local files were then verified by `git hash-object` against the new exact GitHub blobs `4158b1b997fdfaeb8cccc355c70900966480a38e` and `21724c13f0967ed2448bdd95778e7ca9c5ed8273`. A fresh native Linux Node22 execution of the exact test bytes observed **22 tests, 22 PASS, 0 FAIL, 0 SKIP**. These 22 are source-native tests of the no-git-push safety scanner, not full Bostan integration tests.

**Not executed:** the complete adapter/server/CLI scanner across the full Bostan private checkout, B1-126 full 16-case Bash synthetic admission regression, actual four-suite Linux Vitest5/TypeScript7/bwrap integration or installed Windows/macOS/Linux product. No private full Bostan checkout, Node >=24.11, Vitest/TS7 and rootless bwrap are present in the model's isolated runner. Desktop Commander previously reported exhausted monthly quota and explicitly instructed not to retry/reconnect, so it was not called.

**Scope and residual risk:** This is a conservative, text-based static guard. Git supports other command encodings, shell wrappers, executable aliases and dynamic argument constructions; regex coverage cannot substitute for a runtime deny policy or Git credential restrictions. No claim of complete protection from all remote writes.

## Mandatory next release gates

On an authorized disposable owner-marked private QA checkout at this exact Draft head and with preinstalled requirements: run `node --test scripts/check-no-git-push.test.mjs`, `node scripts/check-no-git-push.mjs`, `node --test scripts/bostan-private-linux-vitest-report-audit.test.mjs`, `bash scripts/bostan-private-linux-sandbox-gate.test.sh` (all 16 expected cases), then genuine `bash scripts/bostan-private-linux-sandbox-gate.sh --run` with four required rootless bubblewrap cases, full Vitest and TS7. On installed Windows/macOS/Linux, validate governed side effects/consent and persistence, repeated real PostgreSQL stress #234, privacy/tenant security and donor licenses/NOTICE/provenance.

**Product release: NO-GO**. Preserve repo PRIVATE, all PRs Draft unmerged, main unchanged, GitHub Actions disabled, no publish/deploy/release/npm pack, paid providers, customer data, unowned cleanup or legally required upstream notice removal.
