# B5-40 — OpenCode HY4 free-model admission

Private Bostan qualification work. This does not merge, publish, deploy, or qualify a release.

## Change

Add `opencode/hy4-flash-free` to the explicit model allowlist used by the disposable first-agent and governed-Case QA harnesses. Unknown models and known paid models remain refused. The test suite requires the new model to be explicitly named; it does not change the default model.

## Evidence

- OpenCode model listing included `opencode/hy4-flash-free`.
- The model returned the exact admission response through the Bostan Windows admission helper, using a new disposable TEMP parent, isolated HOME/USERPROFILE, empty workspace, no tools, bounded 75-second runtime and automatic cleanup: PASS.
- The first-agent policy test passed, including refusal of paid, unknown and prompt-injection-shaped model IDs.
- No Bostan database, organization, agent or task was created in this admission probe.

## Qualification boundary

The probe verifies one free-model response under the isolated OpenCode admission path. It does not prove a Bostan-managed task completed, ongoing availability or provider billing reconciliation. A real persisted Bostan task, run-owned comment, independent reviewer and governed Case remain open under issue #34. Existing OpenRouter quota exhaustion is unchanged; no OpenRouter call was made for this check. Keep Draft, private and release NO-GO.
