import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { qualifyGovernedCaseQa, verifyGovernedCaseReceipt, requireLiveSourceHandoffOwner, nativeGovernedCaseAgentConfig, evaluateNativeCaseQaHost } from "./bostan-governed-case-free-e2e.mjs";

test("governed Case E2E refuses missing real-free-model or overlapping scenario opt-in", () => {
  for (const env of [
    {}, { BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E: "1" },
    { BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E: "1", BOSTAN_E2E_TWO_AGENT_TEAM: "1" },
    { BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E: "1", BOSTAN_E2E_REVIEW_FIRST_AGENT: "1" },
  ]) {
    assert.throws(() => qualifyGovernedCaseQa(env));
  }
});
const SOURCE = randomUUID(), REVIEW = randomUUID(), SRC_RUN = randomUUID(), REV_RUN = randomUUID();
function good() {
  return {
    implementationAgentId: SOURCE, reviewerAgentId: REVIEW,
    sourceRun: { id: SRC_RUN, agentId: SOURCE, status: "succeeded", exitCode: 0,
      errorCode: null, usageJson: { costUsd: 0 } },
    reviewRun: { id: REV_RUN, agentId: REVIEW, status: "succeeded", exitCode: 0,
      errorCode: null, usageJson: { costUsd: 0 } },
    sourceDocument: { id: randomUUID() },
    reportDocument: { id: randomUUID(), format: "json" },
    caseState: { status: "done" },
    summary: { current: true, provenanceCurrent: true, reviewerAgentId: REVIEW,
      citedDocumentCount: 1, executionAuthorized: false },
  };
}
test("governed Case accepts only actual distinct green models, current board summary, and $0 reported cost", () => {
  assert.deepEqual(verifyGovernedCaseReceipt(good()), {
    caseDone: true, twoDistinctRealAgentRuns: true,
    verifierAuthoredStructuredReport: true, independentCurrentSourceCitation: true,
    boardSummaryCurrent: true, reportedCostUsd: 0,
  });
  const mutations = [
    a => { a.reviewRun.agentId = SOURCE; },
    a => { a.reviewRun.id = SRC_RUN; },
    a => { a.sourceRun.status = "failed"; },
    a => { a.reviewRun.exitCode = 1; },
    a => { a.reviewRun.usageJson.costUsd = 0.01; },
    a => { a.sourceRun.usageJson.costUsd = 2; },
    a => { a.caseState.status = "in_progress"; },
    a => { a.summary.current = false; },
    a => { a.summary.provenanceCurrent = false; },
    a => { a.summary.reviewerAgentId = SOURCE; },
    a => { a.summary.executionAuthorized = true; },
    a => { a.summary.citedDocumentCount = 0; },
    a => { a.reportDocument.format = "markdown"; },
    a => { a.reportDocument.id = a.sourceDocument.id; },
  ];
  for (const mutate of mutations) {
    const value = good();
    mutate(value);
    assert.throws(() => verifyGovernedCaseReceipt(value));
  }
});


test("case handoff binds ONLY to a live original source assignment after a real source comment", () => {
  const id = randomUUID(), comment = randomUUID();
  const issue = { id: randomUUID(), status: "in_progress", executionRunId: id };
  const assignmentRun = { id, status: "running" };
  assert.equal(requireLiveSourceHandoffOwner({ issue, assignmentRun, sourceCommentId: comment }), true);
  for (const changes of [
    { issue: { ...issue, executionRunId: randomUUID() } },
    { issue: { ...issue, executionRunId: null } },
    { issue: { ...issue, status: "done" } },
    { assignmentRun: { ...assignmentRun, id: randomUUID() } },
    { assignmentRun: { ...assignmentRun, status: "succeeded" } },
    { assignmentRun: { ...assignmentRun, status: "cancelled" } },
    { sourceCommentId: null },
  ]) {
    assert.throws(() => requireLiveSourceHandoffOwner({ issue, assignmentRun,
      sourceCommentId: comment, ...changes }), /Refusing governed Case handoff/);
  }
});

test("governed Case only admits native signed-API runner with all general OpenCode tools denied", () => {
  const config = nativeGovernedCaseAgentConfig({
    model: "opencode/deepseek-v4.1-flash-free", workspace: "/tmp/bostan-qa-only",
  });
  assert.equal(config.provider, "opencode");
  assert.equal(config.opencodePermissionMode, "deny");
  assert.equal(config.lifecycleMode, "per_turn");
  assert.equal(config.cwd, "/tmp/bostan-qa-only");
  assert.ok(!Object.hasOwn(config, "dangerouslySkipPermissions"));
  assert.throws(() => nativeGovernedCaseAgentConfig({
    model: "anthropic/claude-opus-5", workspace: "/tmp/private",
  }), /Only explicitly permitted free test models/);
  assert.throws(() => nativeGovernedCaseAgentConfig({
    model: "opencode/deepseek-v4.1-flash-free", workspace: "relative",
  }), /absolute disposable workspace/);
});

test("native governed Case host preflight refuses low-memory Macs and sparse TEMP, not ordinary app installs", () => {
  const G = 1024 ** 3;
  const good = { platform: "darwin", totalMemoryBytes: 16 * G, freeMemoryBytes: 9 * G, tempFreeBytes: 30 * G };
  assert.deepEqual(evaluateNativeCaseQaHost(good), {
    schema: "bostan.native-governed-case-qa-host.v1",
    qualified: true, blocked: [],
  });
  assert.deepEqual(evaluateNativeCaseQaHost({ ...good, totalMemoryBytes: 8 * G }).blocked,
    ["enoughTotalMemory"]);
  assert.deepEqual(evaluateNativeCaseQaHost({ ...good, freeMemoryBytes: 2 * G }).blocked,
    ["enoughFreeMemory"]);
  assert.deepEqual(evaluateNativeCaseQaHost({ ...good, tempFreeBytes: 4 * G }).blocked,
    ["enoughTempDisk"]);
  assert.deepEqual(evaluateNativeCaseQaHost({ ...good, platform: "win32" }).blocked,
    ["supportedNativePlatform"]);
  assert.equal(evaluateNativeCaseQaHost({ ...good, freeMemoryBytes: null }).qualified, false);
});
test("unreported model costs remain unknown rather than being mislabeled zero", () => {
  const a = good();
  a.reviewRun.usageJson = null;
  assert.equal(verifyGovernedCaseReceipt(a).reportedCostUsd, null);
});
