import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceReviewTask, requirePersistedReviewCitation } from "./bostan-first-agent-free-e2e.mjs";

const sourceIssueId = "24ddccaa-9ec9-4e45-80a2-8239be2b7229";
const sourceCommentId = "64ca010c-e733-4b34-a2bc-b63735d94512";
const sourceAgentId = "e157a6bb-f02b-4e14-8118-e668eff7cd32";
const reviewerAgentId = "968ca1ee-4765-4496-9131-2d7a2d332ab3";
const sourceComments = [
  { id: sourceCommentId, authorAgentId: sourceAgentId, body: "Actual first worker: BOSTAN_CLEAN_RUN_PASS" },
];
const verifiedComment = { id: "a92dfc5d-f958-4841-9fab-88c36f454e14",
  authorAgentId: reviewerAgentId,
  body: "BOSTAN_SECOND_AGENT_PASS BOSTAN_REVIEW_SOURCE_COMMENT_ID:" + sourceCommentId };
const identities = { sourceAgentId, reviewerAgentId };

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
    sourceComments: [{ id: sourceCommentId, authorAgentId: sourceAgentId, body: "no result" }],
    reviewerComments: [verifiedComment], ...identities,
  }), /without an actual persisted/);
  assert.throws(() => requirePersistedReviewCitation({
    sourceComments: [{ id: "fake", authorAgentId: sourceAgentId, body: "BOSTAN_CLEAN_RUN_PASS" }],
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
      sourceComments, reviewerComments: [{ id: "a92dfc5d-f958-4841-9fab-88c36f454e14", authorAgentId: reviewerAgentId, body }], ...identities,
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
  }), /two different authenticated/);
});
