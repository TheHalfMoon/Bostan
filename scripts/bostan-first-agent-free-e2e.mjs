import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { qualifyFreeQaModel, isOpenRouterFreeQaModel } from "./bostan-free-model-policy.mjs";
import { admitOpenRouterZeroCostQa } from "./bostan-openrouter-free-preflight.mjs";
export { qualifyFreeQaModel } from "./bostan-free-model-policy.mjs";
export function syntheticFreeAgentAdapterConfig({ model, workspace, binary, platform = process.platform }) {
  qualifyFreeQaModel(model);
  if (!path.isAbsolute(workspace)) throw new Error("Synthetic agent workspace must be absolute");
  if (platform === "win32" && (!binary || !path.isAbsolute(binary) ||
      !fs.statSync(binary).isFile())) {
    throw new Error("Windows synthetic agent requires an absolute native OpenCode executable");
  }
  return {
    model, cwd: workspace, timeoutSec: 120, maxAgentSteps: 12,
    ...(platform === "win32" ? { command: binary } : {}),
  };
}

const TERMINAL_HEARTBEAT_STATUSES = new Set([
  "succeeded", "failed", "timed_out", "cancelled", "interrupted",
]);

export function observeHeartbeatQaStatus(run) {
  if (!run || typeof run !== "object") throw new Error("Invalid heartbeat result");
  const status = run.status;
  if (typeof status !== "string") throw new Error("Missing heartbeat status");
  if (!TERMINAL_HEARTBEAT_STATUSES.has(status)) return { done: false };
  return { done: true, result: run };
}

export function firstAgentLifecycleReadinessTimeoutMs(platform = process.platform, evidenceReview = false) {
  // Existing ordinary source QA stays at the qualified 90-second Mac/Linux
  // deadline. The explicit cross-agent review admits a longer but FINITE
  // second bounded model-harness check during cold local runtime startup.
  // Windows retains its separate 240-second native QA admission.
  return platform === "win32" ? 240_000 : evidenceReview ? 180_000 : 90_000;
}

export function safeAgentLifecycleDiagnostic(agent) {
  // The API may also contain private environment, credentials or tool logs.
  // Only allowlisted enum-like lifecycle states and a public agent status
  // can leave the disposable QA boundary in a controlled test failure.
  const read = (value) => typeof value === "string" &&
    /^[a-z][a-z0-9_]{0,39}$/.test(value) ? value : null;
  const lifecycleError = typeof agent?.lifecycleError === "string"
    ? agent.lifecycleError : "";
  const failureCode = lifecycleError.startsWith("Execution configuration check failed.")
    ? "harness_test_failed"
    : lifecycleError.startsWith("Agent lifecycle verification failed.")
      ? "lifecycle_verification_failed" : null;
  return { lifecycleState: read(agent?.lifecycleState), status: read(agent?.status),
    ...(failureCode ? { failureCode } : {}) };
}

export function assertHeartbeatQaSucceeded(run) {
  if (run?.status === "succeeded") return;
  // The provider may never have been called. Persisted interruption is
  // terminal and must not be mistaken for a 175-second provider timeout.
  const code = run?.errorCode;
  const stage = run?.executionStage;
  const errorCode = typeof code === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(code) ? code : null;
  const executionStage = typeof stage === "string" &&
    /^(preparing|dispatching|executing|settled)$/.test(stage) ? stage : null;
  throw new Error("Bostan synthetic heartbeat ended without success: " +
    JSON.stringify({ status: run?.status ?? null, errorCode, executionStage }));
}

const MARKER = "BOSTAN_CLEAN_RUN_PASS";
const SECOND_MARKER = "BOSTAN_SECOND_AGENT_PASS";

const REVIEW_EVIDENCE_LABEL = "BOSTAN_REVIEW_SOURCE_COMMENT_ID:";
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

/**
 * A marker alone is NOT a successful model-driven task receipt. Only a
 * persisted, attributed comment created by this exact successful heartbeat
 * run is eligible; stale model output and board comments never count.
 */
function hasStandaloneEvidenceMarker(body, marker) {
  // Callers validate markers against the static, punctuation-free allowlist.
  // Refuse misleading strings such as NOT_BOSTAN_CLEAN_RUN_PASS.
  const re = new RegExp("(^|[^A-Za-z0-9_])" + marker + "(?=$|[^A-Za-z0-9_])");
  return re.test(String(body ?? ""));
}

export function requirePersistedRunComment({ comments, agentId, runId, marker }) {
  if (!Array.isArray(comments) || !UUID_PATTERN.test(agentId) ||
      !UUID_PATTERN.test(runId) || ![MARKER, SECOND_MARKER].includes(marker)) {
    throw new Error("Synthetic Bostan QA requires a valid agent/run and allowlisted marker");
  }
  const comment = comments.find(entry =>
    UUID_PATTERN.test(entry?.id ?? "") && entry.authorAgentId === agentId &&
    entry.createdByRunId === runId &&
    hasStandaloneEvidenceMarker(entry.body ?? entry.content, marker));
  if (!comment) {
    throw new Error("No persisted comment from the exact expected agent and heartbeat run");
  }
  return { commentId: comment.id };
}


/**
 * Only actual persisted source comments qualify; never trust a reviewer's
 * unsupported "verified" prose, a marker copied from the task description,
 * or a guessed/hallucinated comment reference.
 */
export function requirePersistedReviewCitation({
  sourceComments, reviewerComments, sourceAgentId, reviewerAgentId, sourceRunId, reviewerRunId,
  firstMarker = MARKER, secondMarker = SECOND_MARKER,
}) {
  if (!UUID_PATTERN.test(sourceAgentId) || !UUID_PATTERN.test(reviewerAgentId) ||
      !UUID_PATTERN.test(sourceRunId) || !UUID_PATTERN.test(reviewerRunId) ||
      sourceAgentId === reviewerAgentId || sourceRunId === reviewerRunId) {
    throw new Error("Review requires distinct authenticated agents and completed run IDs");
  }
  const originalId = (() => {
    try {
      return requirePersistedRunComment({
        comments: sourceComments, agentId: sourceAgentId, runId: sourceRunId,
        marker: firstMarker,
      }).commentId;
    } catch {
      throw new Error("Review cannot qualify without an actual persisted first-agent source comment");
    }
  })();
  const tag = REVIEW_EVIDENCE_LABEL + originalId;
  const review = reviewerComments.find(c => UUID_PATTERN.test(c?.id ?? "") &&
    c.authorAgentId === reviewerAgentId && c.createdByRunId === reviewerRunId &&
    c.id !== originalId &&
    hasStandaloneEvidenceMarker(c.body ?? c.content, secondMarker) &&
    String(c.body ?? c.content ?? "").includes(tag));
  if (!review) throw new Error("Second agent did not cite the actual persisted source comment ID");
  return { sourceCommentId: originalId, reviewCommentId: review.id ?? null };
}

export function buildEvidenceReviewTask({ sourceIssueId }) {
  if (!UUID_PATTERN.test(sourceIssueId)) throw new Error("Evidence review requires a persisted source issue UUID");
  return "Synthetic private Bostan cross-agent review QA. Inspect the PREVIOUS worker issue " +
    sourceIssueId + " with the available Bostan issue/comment API tools. " +
    "GET the saved comments on that OTHER issue. Confirm that a real persisted comment " +
    "includes the text BOSTAN_CLEAN_RUN_PASS. The current task does not reveal " +
    "the saved comment ID: you must read the previous issue's comments and use the actual returned ID. " +
    "Only if confirmed, post ONE comment on THIS assigned review task containing " +
    SECOND_MARKER + " and exactly " + REVIEW_EVIDENCE_LABEL +
    "<actual source comment UUID>. Then mark ONLY THIS review task done and stop. " +
    "If you cannot retrieve the real source comment, report that and do NOT mark done. " +
    "Do not inspect unrelated files, make external side effects, or invent IDs.";
}

const MANAGED = "bostan-managed-source-runtime-v1";

function tempRoots() {
  return [os.tmpdir(), "/tmp"].flatMap((p) => {
    try { return [fs.realpathSync(p)]; } catch { return []; }
  });
}
export function qualifyDisposableFirstAgentScope({
  url, home, confirmed, onlineModelApproved,
}) {
  if (confirmed !== "1" || onlineModelApproved !== "1") {
    throw new Error("Explicit disposable-data confirmation and free online-model opt-in are required");
  }
  if (!url || !home) throw new Error("Explicit localhost URL and disposable HOME are required");
  const base = new URL(url);
  if (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname)
    || !base.port || Number(base.port) < 1024
    || base.pathname !== "/" || base.search || base.hash || base.username || base.password) {
    throw new Error("Refusing non-local or ambiguous Bostan test URL");
  }
  if (!path.isAbsolute(home) || path.normalize(home) !== home) {
    throw new Error("Bostan QA requires a normalized absolute disposable HOME");
  }
  const homeReal = fs.realpathSync(home);
  if (!tempRoots().some((root) => homeReal.startsWith(root + path.sep))) {
    throw new Error("Refusing a non-temporary HOME for Bostan first-agent QA");
  }
  const app = path.join(homeReal, ".bostan", "app");
  const configFile = path.join(app, "state", "instances", "local", "config.json");
  const lockFile = path.join(app, "run.lock");
  const stat = fs.lstatSync(configFile);
  const lockStat = fs.lstatSync(lockFile);
  if (!stat.isFile() || stat.isSymbolicLink() || !lockStat.isFile() || lockStat.isSymbolicLink()) {
    throw new Error("Unsafe Bostan QA configuration or runtime lock");
  }
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  if (config.bostanManagedLocalRuntime !== MANAGED
    || config.server?.host !== "127.0.0.1" || config.server?.bind !== "loopback"
    || config.server?.exposure !== "private" || config.server?.port !== Number(base.port)
    || config.telemetry?.enabled !== false) {
    throw new Error("Target is not an explicitly isolated Bostan source-only instance");
  }
  if (!fs.readFileSync(lockFile, "utf8").startsWith(MANAGED + ":")) {
    throw new Error("Target has no known Bostan runtime ownership lock");
  }
  return { base, home: homeReal };
}

async function requestJson(base, endpoint, body) {
  const response = await fetch(new URL("/api/" + endpoint, base), {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error("Bostan QA " + endpoint + " HTTP " + response.status + ": " +
      JSON.stringify(json).slice(0, 500));
  }
  return json;
}
async function waitFor(check, { timeoutMs, intervalMs = 3_000, label, diagnostic }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value.done) return value.result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Bostan QA timed out waiting for " + label +
    (diagnostic ? ": " + JSON.stringify(diagnostic()) : ""));
}
export async function runFirstAgentFreeE2e(env = process.env) {
  const { base, home } = qualifyDisposableFirstAgentScope({
    url: env.BOSTAN_E2E_URL,
    home: env.BOSTAN_E2E_DISPOSABLE_HOME,
    confirmed: env.BOSTAN_E2E_CONFIRM_TEMP_DATA,
    onlineModelApproved: env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL,
  });
  const model = qualifyFreeQaModel(env.BOSTAN_E2E_FREE_MODEL);
  // A direct caller must independently verify the live free-only catalog too.
  // The outer source runtime already performs this before any temp data exists.
  if (isOpenRouterFreeQaModel(model)) {
    await admitOpenRouterZeroCostQa({ model, env });
  }
  // Windows native admission happens before creating any Bostan organization
  // or agent. A model catalog listing is not proof of working inference.
  if (process.platform === "win32") {
    const { admitFreeOpenCodeModel } = await import("./bostan-opencode-free-admission.mjs");
    await admitFreeOpenCodeModel({
      parent: home, model, executable: env.BOSTAN_E2E_OPENCODE_EXE, env,
    });
  }
  const health = await requestJson(base, "health");
  if (health.status !== "ok" || health.deploymentMode !== "local_trusted"
    || health.deploymentExposure !== "private") {
    throw new Error("Refusing a non-private or unhealthy Bostan instance");
  }
  const id = randomUUID();
  const company = await requestJson(base, "companies", { name: "Bostan Synthetic Free QA " + id });
  if (!company?.id) throw new Error("Bostan did not create a synthetic organization");
  const workspace = path.join(home, ".bostan", "agent-free-e2e-workspace");
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  const agent = await requestJson(base, "companies/" + company.id + "/agents", {
    name: "Bostan Clean Free QA Worker",
    role: "general",
    adapterType: "opencode_local",
    runner: "legacy",
    adapterConfig: syntheticFreeAgentAdapterConfig({
      model, workspace, binary: env.BOSTAN_E2E_OPENCODE_EXE,
    }),
    budgetMonthlyCents: 0,
  });
  if (agent.adapterType !== "opencode_local") throw new Error("Wrong Bostan agent adapter");
  let firstLifecycle = null;
  await waitFor(async () => {
    const current = await requestJson(base, "agents/" + agent.id);
    firstLifecycle = safeAgentLifecycleDiagnostic(current);
    if (firstLifecycle.failureCode) throw new Error("Bostan first agent admission blocked: " +
      JSON.stringify(firstLifecycle));
    if (current.lifecycleState === "ready") return { done: true, result: current };
    if (["failed", "terminated"].includes(current.lifecycleState)) {
      throw new Error("Bostan first agent lifecycle failed: " + JSON.stringify(firstLifecycle));
    }
    return { done: false };
  }, { timeoutMs: firstAgentLifecycleReadinessTimeoutMs(process.platform, env.BOSTAN_E2E_REVIEW_FIRST_AGENT === "1"),
    label: "first-agent readiness", diagnostic: () => firstLifecycle });
  const issue = await requestJson(base, "companies/" + company.id + "/issues", {
    title: "Synthetic Bostan free agent execution QA " + id,
    description: "Synthetic, disposable QA. Post ONE task comment containing " + MARKER +
      ", mark this issue done, give your final answer, and immediately stop. " +
      "Do not inspect files or run unrelated shell commands.",
    status: "todo", assigneeAgentId: agent.id,
  });
  const started = await requestJson(base, "agents/" + agent.id + "/heartbeat/invoke", {});
  const run = await waitFor(async () => {
    const current = await requestJson(base, "heartbeat-runs/" + started.id);
    return observeHeartbeatQaStatus(current);
  }, { timeoutMs: 175_000, label: "agent heartbeat terminal status" });
  assertHeartbeatQaSucceeded(run);
  const finalIssue = await requestJson(base, "issues/" + issue.id);
  const commentResult = await requestJson(base, "issues/" + issue.id + "/comments");
  const comments = Array.isArray(commentResult) ? commentResult : commentResult.comments ?? [];
  const sourceReceipt = requirePersistedRunComment({
    comments, agentId: agent.id, runId: run.id, marker: MARKER,
  });
  const clean = run.status === "succeeded" && run.exitCode === 0
    && run.errorCode == null && finalIssue.status === "done";
  if (!clean) {
    throw new Error("Bostan first agent did not qualify clean completion: " +
      JSON.stringify({ runStatus: run.status, exitCode: run.exitCode,
        errorCode: run.errorCode, issueStatus: finalIssue.status,
        attributedCommentId: sourceReceipt.commentId }));
  }
  console.log("Bostan first real free agent E2E PASS: " +
    JSON.stringify({ model, companyId: company.id, agentId: agent.id, issueId: issue.id,
      runId: run.id, runStatus: run.status, exitCode: run.exitCode,
      issueStatus: finalIssue.status, exactMarkerFound: true,
      attributedCommentId: sourceReceipt.commentId,
      reportedCostUsd: run.usageJson?.costUsd ?? null }));

  // B5-18: a strictly opt-in second actual free-model worker on another task
  // within the SAME synthetic company. This is sequential multi-agent
  // execution, NOT independent factual verification or canonical B5 review.
  if (env.BOSTAN_E2E_TWO_AGENT_TEAM === "1") {
    const secondWorkspace = path.join(home, ".bostan", "second-agent-e2e-workspace");
    fs.mkdirSync(secondWorkspace, { recursive: true, mode: 0o700 });
    const secondAgent = await requestJson(base, "companies/" + company.id + "/agents", {
      name: "Bostan Synthetic Second Free QA Worker",
      role: "engineer",
      adapterType: "opencode_local",
      runner: "legacy",
      adapterConfig: syntheticFreeAgentAdapterConfig({
        model, workspace: secondWorkspace, binary: env.BOSTAN_E2E_OPENCODE_EXE,
      }),
      budgetMonthlyCents: 0,
    });
    if (!secondAgent?.id || secondAgent.id === agent.id ||
        secondAgent.adapterType !== "opencode_local") {
      throw new Error("Bostan second QA worker did not have an independent agent identity");
    }
    let secondLifecycle = null;
    await waitFor(async () => {
      const current = await requestJson(base, "agents/" + secondAgent.id);
      secondLifecycle = safeAgentLifecycleDiagnostic(current);
      if (secondLifecycle.failureCode) throw new Error("Bostan second agent admission blocked: " +
        JSON.stringify(secondLifecycle));
      if (current.lifecycleState === "ready") return { done: true, result: current };
      if (["failed", "terminated"].includes(current.lifecycleState)) {
        throw new Error("Bostan second agent lifecycle failed: " + JSON.stringify(secondLifecycle));
      }
      return { done: false };
    }, { timeoutMs: firstAgentLifecycleReadinessTimeoutMs(process.platform, env.BOSTAN_E2E_REVIEW_FIRST_AGENT === "1"),
      label: "second-agent readiness", diagnostic: () => secondLifecycle });
    const reviewMode = env.BOSTAN_E2E_REVIEW_FIRST_AGENT === "1";
    const reviewDescription = reviewMode
      ? buildEvidenceReviewTask({ sourceIssueId: issue.id })
      : "Synthetic disposable second worker task following a previously completed " +
        "first worker task. Post ONE task comment containing " + SECOND_MARKER +
        ", mark THIS issue done, give your final answer and immediately stop. " +
        "Do not inspect unrelated files or use extra shell commands.";
    const secondIssue = await requestJson(base, "companies/" + company.id + "/issues", {
      title: (reviewMode ? "Source-citing second worker review QA " :
        "Independent second worker synthetic execution QA ") + id,
      description: reviewDescription, status: "todo", assigneeAgentId: secondAgent.id,
    });
    if (!secondIssue?.id || secondIssue.id === issue.id) {
      throw new Error("Bostan second QA issue must be independent of the first task");
    }
    const invoked = await requestJson(base, "agents/" + secondAgent.id + "/heartbeat/invoke", {});
    const secondRun = await waitFor(async () => {
      const current = await requestJson(base, "heartbeat-runs/" + invoked.id);
      return observeHeartbeatQaStatus(current);
    }, { timeoutMs: 175_000, label: "second agent heartbeat terminal status" });
    assertHeartbeatQaSucceeded(secondRun);
    const secondResult = await requestJson(base, "issues/" + secondIssue.id);
    const secondCommentsResponse = await requestJson(base, "issues/" + secondIssue.id + "/comments");
    const secondComments = Array.isArray(secondCommentsResponse) ? secondCommentsResponse
      : secondCommentsResponse.comments ?? [];
    const secondReceipt = requirePersistedRunComment({
      comments: secondComments, agentId: secondAgent.id,
      runId: secondRun.id, marker: SECOND_MARKER,
    });
    const citation = reviewMode
      ? requirePersistedReviewCitation({ sourceComments: comments, reviewerComments: secondComments,
        sourceAgentId: agent.id, reviewerAgentId: secondAgent.id,
        sourceRunId: run.id, reviewerRunId: secondRun.id })
      : null;
    if (secondRun.id === run.id || secondRun.status !== "succeeded" ||
        secondRun.exitCode !== 0 || secondRun.errorCode != null ||
        secondResult.status !== "done") {
      throw new Error("Second actual Bostan worker did not qualify the distinct completion " +
        JSON.stringify({ status: secondRun.status, exitCode: secondRun.exitCode,
          issueStatus: secondResult.status, attributedCommentId: secondReceipt.commentId }));
    }
    console.log("Bostan B5-18 distinct second real free agent E2E PASS: " +
      JSON.stringify({ model, companyId: company.id, firstAgentId: agent.id,
        secondAgentId: secondAgent.id, firstIssueId: issue.id,
        secondIssueId: secondIssue.id, firstRunId: run.id, secondRunId: secondRun.id,
        secondRunStatus: secondRun.status, secondExitCode: secondRun.exitCode,
        secondIssueStatus: secondResult.status, secondExactMarkerFound: true,
        secondAttributedCommentId: secondReceipt.commentId,
        ...(citation ? { persistedSourceCommentCited: true,
          sourceCommentId: citation.sourceCommentId,
          reviewerCommentId: citation.reviewCommentId } : {}),
        reportedCostUsd: secondRun.usageJson?.costUsd ?? null }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runFirstAgentFreeE2e();
}
