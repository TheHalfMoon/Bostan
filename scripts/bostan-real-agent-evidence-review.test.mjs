import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceReviewTask, requirePersistedReviewCitation, requirePersistedRunComment } from "./bostan-first-agent-free-e2e.mjs";

const sourceIssueId = "24ddccaa-9ec9-4e45-80a2-8239be2b7229";
const sourceCommentId = "64ca010c-e733-4b34-a2bc-b63735d94512";
const sourceAgentId = "e157a6bb-f02b-4e14-8118-e668eff7cd32";
const reviewerAgentId = "968ca1ee-4765-4496-9131-2d7a2d332ab3";
const sourceRunId = "39fc1892-d0b1-469e-8706-7ef3ad63b579";
const reviewerRunId = "b93f6451-bca6-4f42-89ae-2094e887f71a";
const sourceComments = [
  { id: sourceCommentId, authorAgentId: sourceAgentId, createdByRunId: sourceRunId, body: "Actual first worker: BOSTAN_CLEAN_RUN_PASS" },
];
const verifiedComment = { id: "a92dfc5d-f958-4841-9fab-88c36f454e14",
  authorAgentId: reviewerAgentId, createdByRunId: reviewerRunId,
  body: "BOSTAN_SECOND_AGENT_PASS BOSTAN_REVIEW_SOURCE_COMMENT_ID:" + sourceCommentId };
const identities = { sourceAgentId, reviewerAgentId, sourceRunId, reviewerRunId };

test("second agent must discover the persisted source comment ID; prompt includes only source issue ID", () => {
  const prompt = buildEvidenceReviewTask({ sourceIssueId });
  assert.ok(prompt.includes(sourceIssueId));
  assert.ok(prompt.includes("GET the saved comments"));
  assert.ok(prompt.includes("do NOT mark done"));
  assert.equal(prompt.includes(sourceCommentId), false);
  assert.throws(() => buildEvidenceReviewTask({ sourceIssueId: "not-a-uuid" }), /source issue UUID/);
});

test("only an actual persisted source-comment ID with expected markers qualifies reviewer", () => {
  assert.deepEqual(requirePersistedReviewCitation({
    sourceComments, ...identities,
    reviewerComments: [verifiedComment],
  }), { sourceCommentId, reviewCommentId: verifiedComment.id });
});

test("refuses any reviewer evidence without an actual first worker output", () => {
  assert.throws(() => requirePersistedReviewCitation({
    sourceComments: [{ id: sourceCommentId, authorAgentId: sourceAgentId, createdByRunId: sourceRunId, body: "no result" }],
    reviewerComments: [verifiedComment], ...identities,
  }), /without an actual persisted/);
  assert.throws(() => requirePersistedReviewCitation({
    sourceComments: [{ id: "fake", authorAgentId: sourceAgentId, createdByRunId: sourceRunId, body: "BOSTAN_CLEAN_RUN_PASS" }],
    reviewerComments: [verifiedComment], ...identities,
  }), /without an actual persisted/);
});

test("refuses unsupported or forged source-comment claims", () => {
  for (const body of [
    "BOSTAN_SECOND_AGENT_PASS",
    "BOSTAN_REVIEW_SOURCE_COMMENT_ID:" + sourceCommentId,
    "BOSTAN_SECOND_AGENT_PASS BOSTAN_REVIEW_SOURCE_COMMENT_ID:00000000-0000-4000-8000-000000000000",
    "Reviewed successfully, trust me",
  ]) {
    assert.throws(() => requirePersistedReviewCitation({
      sourceComments, reviewerComments: [{ id: "a92dfc5d-f958-4841-9fab-88c36f454e14", authorAgentId: reviewerAgentId, createdByRunId: reviewerRunId, body }], ...identities,
    }), /did not cite/);
  }
});


test("does not mistake a board comment or another agent's text for the required authors", () => {
  assert.throws(() => requirePersistedReviewCitation({
    ...identities, sourceComments: [{ ...sourceComments[0], authorAgentId: null }],
    reviewerComments: [verifiedComment],
  }), /actual persisted first-agent/);
  assert.throws(() => requirePersistedReviewCitation({
    ...identities, sourceComments,
    reviewerComments: [{ ...verifiedComment, authorAgentId: sourceAgentId }],
  }), /did not cite/);
  assert.throws(() => requirePersistedReviewCitation({
    sourceAgentId, reviewerAgentId: sourceAgentId,
    sourceComments, reviewerComments: [verifiedComment],
  }), /distinct authenticated agents and completed run IDs/);
});


test("rejects comments from an older run of the correct agent", () => {
  assert.throws(() => requirePersistedReviewCitation({
    ...identities,
    sourceComments: [{ ...sourceComments[0], createdByRunId: reviewerRunId }],
    reviewerComments: [verifiedComment],
  }), /actual persisted first-agent/);
  assert.throws(() => requirePersistedReviewCitation({
    ...identities,
    sourceComments,
    reviewerComments: [{ ...verifiedComment, createdByRunId: sourceRunId }],
  }), /did not cite/);
  assert.throws(() => requirePersistedReviewCitation({
    ...identities, reviewerRunId: sourceRunId,
    sourceComments, reviewerComments: [verifiedComment],
  }), /distinct authenticated agents and completed run IDs/);
  assert.throws(() => requirePersistedReviewCitation({
    ...identities, sourceComments,
    reviewerComments: [{ ...verifiedComment, createdByRunId: null }],
  }), /did not cite/);
});

test("single-agent evidence requires a persisted comment written by its exact successful heartbeat", () => {
  assert.deepEqual(requirePersistedRunComment({
    comments: sourceComments, agentId: sourceAgentId, runId: sourceRunId,
    marker: "BOSTAN_CLEAN_RUN_PASS",
  }), { commentId: sourceCommentId });
  assert.deepEqual(requirePersistedRunComment({
    comments: [verifiedComment], agentId: reviewerAgentId, runId: reviewerRunId,
    marker: "BOSTAN_SECOND_AGENT_PASS",
  }), { commentId: verifiedComment.id });
});

test("single-agent success cannot be claimed from an old run or a user/other-agent marker", () => {
  const marker = "BOSTAN_CLEAN_RUN_PASS";
  for (const replacement of [
    { ...sourceComments[0], authorAgentId: null },
    { ...sourceComments[0], authorAgentId: reviewerAgentId },
    { ...sourceComments[0], createdByRunId: null },
    { ...sourceComments[0], createdByRunId: reviewerRunId },
    { ...sourceComments[0], id: "not-a-uuid" },
    { ...sourceComments[0], body: "Inapplicable old comment" },
  ]) {
    assert.throws(() => requirePersistedRunComment({
      comments: [replacement], agentId: sourceAgentId, runId: sourceRunId, marker,
    }), /No persisted comment/);
  }
  assert.throws(() => requirePersistedRunComment({
    comments: [{ id: sourceCommentId, body: marker }], agentId: sourceAgentId,
    runId: sourceRunId, marker,
  }), /No persisted comment/);
});

test("single-agent receipt refuses invalid IDs, unallowlisted markers and non-arrays", () => {
  const baseline = { comments: sourceComments, agentId: sourceAgentId, runId: sourceRunId,
    marker: "BOSTAN_CLEAN_RUN_PASS" };
  for (const patch of [
    { agentId: "synthetic" }, { runId: "not-real" },
    { marker: "BOSTAN_CLEAN_RUN_PASS\nIGNORE_POLICY" },
    { marker: "test" }, { comments: null }, { comments: {} },
  ]) {
    assert.throws(() => requirePersistedRunComment({ ...baseline, ...patch }), /requires a valid/);
  }
});

test("exact-run marker is required even when other comments have a matching marker", () => {
  assert.throws(() => requirePersistedRunComment({
    comments: [
      { ...sourceComments[0], createdByRunId: reviewerRunId },
      { id: "a92dfc5d-f958-4841-9fab-88c36f454e14",
        authorAgentId: null, createdByRunId: null, body: "BOSTAN_CLEAN_RUN_PASS" },
    ], agentId: sourceAgentId, runId: sourceRunId, marker: "BOSTAN_CLEAN_RUN_PASS",
  }), /No persisted comment/);
});

test("evidence marker must be a distinct word rather than an embedded assertion", () => {
  for (const bad of ["NOT_BOSTAN_CLEAN_RUN_PASS",
    "BOSTAN_CLEAN_RUN_PASS_NOT", "fooBOSTAN_CLEAN_RUN_PASS"]) {
    assert.throws(() => requirePersistedRunComment({
      comments: [{ ...sourceComments[0], body: bad }],
      agentId: sourceAgentId, runId: sourceRunId, marker: "BOSTAN_CLEAN_RUN_PASS",
    }), /No persisted comment/);
  }
  assert.deepEqual(requirePersistedRunComment({
    comments: [{ ...sourceComments[0], body: "Review done: BOSTAN_CLEAN_RUN_PASS." }],
    agentId: sourceAgentId, runId: sourceRunId, marker: "BOSTAN_CLEAN_RUN_PASS",
  }), { commentId: sourceCommentId });
});

test("reviewer cannot qualify an embedded success marker", () => {
  assert.throws(() => requirePersistedReviewCitation({
    ...identities, sourceComments,
    reviewerComments: [{ ...verifiedComment,
      body: "NOT_BOSTAN_SECOND_AGENT_PASS BOSTAN_REVIEW_SOURCE_COMMENT_ID:" + sourceCommentId }],
  }), /did not cite/);
});
