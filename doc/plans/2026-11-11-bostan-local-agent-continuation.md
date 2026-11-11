# Local agent execution evidence and continuation — 2026-11-11

The product remains unfinished. No publication, signing, notarization,
deployment, release tag or paid provider call was performed.

## Verified baseline and active work

- Main `7524763280232f9f15f4b0677568a593433cd426` contains merged #547.
  Its post-merge Bostan CI run `43030026976` passed all 15 jobs. #544–#546
  were closed as absorbed. This does not establish complete product branding.
- #548 (`work/bostan-adapter-copy`, head `59edee6f`) is rebased onto that main;
  full run `43030300442` is still pending. Do not claim queued lanes passed.
- #542 (`work/desktop-runtime`, head `97ff8a77`) includes the merged branding.
  Run `43034666672` is pending. Windows ACL and native host tests passed in
  preceding run `43030893239` before that Windows job was superseded; the
  installed Windows lifecycle has not passed. Mac found 58,249 missing runtime
  dependency entries. The new explicit dependency resource mapping reproduces
  and fixes the actual builder filter in local tests: 23 PASS / 1 POSIX-only
  SKIP. Native package/lifecycle acceptance remains pending.
- The other engineer owns #543 and `D:/Bostan-recon-20261108`; do not edit it.
  Last inspected head `a036c79c` still failed Windows qualification. Reuse its
  qualified correction when available; do not duplicate that active work.

## Real local model work

The owner explicitly requested another OpenCode model. Installed zero-cost
`qwen2.5:1.5b` through Ollama (986 MB download) and created the test-owned alias
`bostan-qa-qwen25-20261111`. Its final Modelfile is:

```text
FROM qwen2.5:1.5b
PARAMETER num_ctx 2048
PARAMETER num_predict 128
PARAMETER temperature 0
```

An isolated direct invocation of the real Bostan OpenCode adapter, using actual
OpenCode 2.2.5 and Ollama, returned exactly `BOSTAN_LOCAL_AGENT_OK` in 8,724 ms.
The scope was a synthetic text-only task, with a two-step budget, explicit
`--standalone`, fresh HOME/XDG directories, denied tools, a custom concise build
prompt, and one admitted OpenAI-compatible provider pointing at loopback Ollama.
The small/auxiliary model was pinned to the same local alias. A loopback proxy
recorded provider/model/settings metadata and forwarded actual inference; it did
not fabricate completions. No operator credentials/configuration were inherited.
The diagnostic wrapper and test-owned model loading were stopped afterward.

Failures remain part of the record. Qwen3 0.6B generated an incorrect tool call
at its one-step boundary. The first Qwen2.5 attempt hit an existing managed
service port before inference; explicit standalone mode avoids that service,
whose ownership was not established and which was left untouched. Qwen2.5
one-step runs returned empty completions at both 1,024/2,048-token contexts;
its direct Ollama check returned the expected text. Captured OpenCode request
metadata showed an added terminal-step assistant prefill at one step. At two
steps the first request had only system/user messages and completed correctly.
Do not describe those earlier attempts as successful tasks.

This is live adapter text-task evidence from a source working tree, not an
in-app persisted task, installed-app journey, tool/MCP qualification, restart
proof, full network capture, sandbox-isolation claim or final-source acceptance.
The full first-agent journey still needs a synthetic account/company/agent/task
driven through the actual server and packaged application.

## Correctness and native Windows fixes

The failed live run exposed a real result bug: a zero-exit CLI with terminal
`tool-calls` and the fixed maximum-step refusal was reported as success. The
adapter now reports `opencode_step_limit_exceeded`. Ordinary tool errors that
are followed by a completed turn remain recoverable. A bounded observer keeps
this outcome even when display stdout is clipped; accounting projection still
omits content/tool state. Existing string compaction is reused without changing
accounting behavior. Observer faults become fixed failure messages only for
otherwise-clean results; transport, timeout and existing provider errors keep
their priority. Two independent-review findings in those priority paths were
fixed and covered by fault tests.

An existing Windows test also revealed missing skill delivery: the shared
directory-link default required privileged symlink creation. It now uses a
Windows directory junction, with normal directory symlinks on POSIX. Existing
real directories/live foreign links are preserved; dangling links are repaired.
Codex/Cursor paths that supply their own callbacks remain separate work; this
does not establish fleet-wide Windows skill delivery.

Final focused Windows verification: 48 PASS across OpenCode parser/executor and
usage-checkpoint suites, plus 2 PASS real link creation/repair/preservation tests
(50 unique tests). Before the junction fix the same three-suite run had 47 PASS
and one configured-child-HOME skill failure. Earlier red tests and two review
findings are not omitted from this acceptance history. Package typechecks pass.
Fresh independent correctness/product/parsimony and security reviews passed for
both outcome handling and the directory-link change. Full exact-head CI is still
required before merging this phase.

```sh
rtk proxy pnpm exec vitest run packages/adapters/opencode-local/src/server/parse.test.ts packages/adapters/opencode-local/src/server/execute.test.ts packages/adapter-utils/src/usage-checkpoint.test.ts packages/adapter-utils/src/skill-symlink.test.ts --maxWorkers=1
rtk proxy pnpm --filter @bostan/adapter-opencode-local typecheck
rtk proxy pnpm --filter @bostan/adapter-utils typecheck
```

Continue: qualify and land pending exact heads; repair remaining native desktop
failures; integrate the qualified compiled correction; run a real persisted
local-agent task; finish runtime identity migration, pinned Runner attribution,
data/update/rollback/privacy tests and dependency review. Publication protections
stay in place. There is no recurring autonomous execution mechanism configured.
