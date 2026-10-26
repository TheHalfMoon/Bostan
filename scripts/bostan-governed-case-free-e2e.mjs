/**
 * Private, explicitly opt-in real-free-model Bostan governed Case qualification.
 * No real account data, paid inference, external effects, or release deployment.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { qualifyFreeQaModel, isOpenRouterFreeQaModel } from "./bostan-free-model-policy.mjs";
import { admitOpenRouterZeroCostQa } from "./bostan-openrouter-free-preflight.mjs";
import { qualifyDisposableFirstAgentScope, selectSingleAssignmentRun,
  observeHeartbeatQaStatus,
  assertHeartbeatQaSucceeded, requirePersistedRunComment } from "./bostan-first-agent-free-e2e.mjs";

const SOURCE_MARKER = "BOSTAN_CLEAN_RUN_PASS";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const GIB = 1024 ** 3;
/**
 * These are conservative native *QA qualification* budgets, not the minimum
 * requirements Bostan publishes for ordinary desktop users. PRP's pinned
 * OpenCode bridge may start a separate runner daemon and browser/web server;
 * insufficient free RAM left it indefinitely in preparing on an 8-GiB Mac.
 */
export const NATIVE_CASE_QA_BUDGET = Object.freeze({
  totalMemoryGiB: 12, freeMemoryGiB: 6, tempFreeGiB: 8,
});
export function evaluateNativeCaseQaHost(input, budget = NATIVE_CASE_QA_BUDGET) {
  const supported = ["darwin", "linux"].includes(input?.platform);
  const enough = (actual, required) =>
    Number.isSafeInteger(actual) && actual >= required * GIB;
  const checks = {
    supportedNativePlatform: supported,
    enoughTotalMemory: enough(input?.totalMemoryBytes, budget.totalMemoryGiB),
    enoughFreeMemory: enough(input?.freeMemoryBytes, budget.freeMemoryGiB),
    enoughTempDisk: enough(input?.tempFreeBytes, budget.tempFreeGiB),
  };
  return {
    schema: "bostan.native-governed-case-qa-host.v1",
    qualified: Object.values(checks).every(Boolean),
    blocked: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
  };
}
export function inspectNativeCaseQaHost() {
  let tempFreeBytes = null;
  try {
    const disk = fs.statfsSync(os.tmpdir());
    const free = Number(disk.bavail) * Number(disk.bsize);
    if (Number.isSafeInteger(free)) tempFreeBytes = free;
  } catch { /* Missing inspection is never a positive resource receipt. */ }
  return evaluateNativeCaseQaHost({
    platform: process.platform,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    tempFreeBytes,
  });
}
export function requireNativeCaseQaHost() {
  const result = inspectNativeCaseQaHost();
  if (!result.qualified) {
    throw new Error("Native governed Case QA capacity is unqualified: " +
      result.blocked.join(",") + ". No server, agent, model, or local data should be started.");
  }
  return result;
}

/**
 * The real native reviewer needs search_api and call_api to read current HMACs.
 * This disposable scenario creates a random company ID, so a preconfigured
 * company allowlist cannot include it. Refuse disabled/disallowed API tools
 * before spinning up Bostan or a provider and don't change rollout policy.
 */
export function requireNativeCaseApiToolAdmission(env = process.env) {
  if (env.PAPERCLIP_RUNNER_API_TOOLS_ENABLED !== undefined
    && env.PAPERCLIP_RUNNER_API_TOOLS_ENABLED !== "true") {
    throw new Error("Native Case QA requires server-enabled signed API tools; rollout is disabled");
  }
  if (env.PAPERCLIP_RUNNER_API_TOOLS_COMPANY_IDS !== undefined) {
    throw new Error("Native Case QA random disposable company cannot satisfy a fixed API company allowlist");
  }
  return true;
}

export function qualifyGovernedCaseQa(env = process.env) {
  if (env.BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E !== "1"
    || env.BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E !== "1"
    || env.BOSTAN_E2E_TWO_AGENT_TEAM === "1"
    || env.BOSTAN_E2E_REVIEW_FIRST_AGENT === "1") {
    throw new Error("Governed Case QA requires its independent opt-in, not overlapping worker scenarios");
  }
  requireNativeCaseApiToolAdmission(env);
  const { base, home } = qualifyDisposableFirstAgentScope({
    url: env.BOSTAN_E2E_URL, home: env.BOSTAN_E2E_DISPOSABLE_HOME,
    confirmed: env.BOSTAN_E2E_CONFIRM_TEMP_DATA,
    onlineModelApproved: env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL,
  });
  const model = qualifyFreeQaModel(env.BOSTAN_E2E_FREE_MODEL);
  return { base, home, model };
}

/**
 * The legacy OpenCode agent injects permission=allow and exposes host shell.
 * Governed Case QA MUST use native PRP's scoped, signed API tool bridge with
 * OpenCode's own general-purpose shell/read/edit permissions denied.
 */
export function nativeGovernedCaseAgentConfig({ model, workspace }) {
  qualifyFreeQaModel(model);
  if (!path.isAbsolute(workspace)) throw new Error("Governed Case needs an absolute disposable workspace");
  return {
    provider: "opencode", model, cwd: workspace,
    opencodePermissionMode: "deny", lifecycleMode: "per_turn",
    timeoutSec: 160,
  };
}

/**
 * These are first-party tool names advertised by the native signed bridge.
 * The model must discover the source-snapshot operationId, not invent a REST
 * result or obtain untrusted content through the host shell.
 */
export function buildNativeSourceCaseInstructions() {
  return [
    "For this CURRENT assigned synthetic Bostan task, use first-party get_task to read the task.",
    "Use list_task_documents and read_task_document with key bostan-source to inspect real persisted source.",
    "Check the synthetic source token A7 before recording your work.",
    "Use comment_on_task to persist the exact standalone marker " + SOURCE_MARKER + " on this task.",
    "Use get_task and read_task_document to read the actual persisted issue and source back.",
    "DO NOT mark this Case or task Done; a separate verifier and the board must finish it.",
    "DO NOT call shell/curl, external providers, or access unrelated files, data or tasks.",
    "If any required named tool is absent, report the blocker instead of inventing a task receipt.",
  ].join(" ");
}

export function buildNativeVerifierCaseInstructions({ companyId, issueId, documentId }) {
  if (![companyId, issueId, documentId].every(id => UUID.test(id))) {
    throw new Error("Native reviewer needs real company, task and source document UUIDs");
  }
  return [
    "You are the independent reviewer of this synthetic Bostan Case work task " + issueId + ".",
    "Use get_task with taskId=" + issueId +
      ", list_task_documents with taskId=" + issueId +
      ", and read_task_document with taskId=" + issueId + " and key=bostan-source.",
    "Use search_api to discover the exact first-party GET snapshot API operation",
    "/api/companies/{companyId}/issues/{issueId}/bostan-verification/sources/{documentId}/snapshot.",
    "The persisted path IDs are companyId=" + companyId + ", issueId=" + issueId + ", documentId=" + documentId + ".",
    "Use call_api with the operationId actually RETURNED BY search_api and those pathParams.",
    "Inspect the authenticated response's sourceSnapshotHmacSha256 field; never invent or estimate it.",
    "Verify this independent source truly supports the synthetic audit statement. Do not write a pass report if it does not.",
    "If and only if valid, call the EXACT native tool write_task_document with taskId=" + issueId +
      ", key=bostan-verification, title=Verifier assessment, format=json, and baseRevisionId=null.",
    "IMPORTANT: baseRevisionId is REQUIRED by write_task_document even for a new report; pass explicit JSON null, do not omit the field.",
    "The tool body MUST be a JSON STRING containing only schema=bostan.verification.report.v1,",
    "verdict=pass, summary of 40-3000 characters, and sources as an array of objects.",
    "Each sources object must have documentId=" + documentId +
      " and expectedSnapshotHmacSha256 copied from the actual authenticated snapshot.",
    "Use read_task_document with taskId=" + issueId +
      " and key=bostan-verification to confirm the resulting JSON document was persisted.",
    "DO NOT mark task Done. Do not use shell, curl, external services, or invented tool results.",
    "If any named tool is unavailable, report that blocker; final prose is not a signed saved report.",
  ].join(" ");
}

export function verifyGovernedCaseReceipt({
  caseState, sourceRun, reviewRun, implementationAgentId, reviewerAgentId,
  sourceDocument, reportDocument, summary,
}) {
  if (!UUID.test(implementationAgentId) || !UUID.test(reviewerAgentId)
    || implementationAgentId === reviewerAgentId
    || sourceRun?.agentId !== implementationAgentId
    || reviewRun?.agentId !== reviewerAgentId
    || !UUID.test(sourceRun?.id ?? "") || !UUID.test(reviewRun?.id ?? "")
    || sourceRun.id === reviewRun.id) {
    throw new Error("Governed Case needs distinct persisted specialist and verifier run identities");
  }
  assertHeartbeatQaSucceeded(sourceRun);
  assertHeartbeatQaSucceeded(reviewRun);
  if (sourceRun.exitCode !== 0 || reviewRun.exitCode !== 0
    || sourceRun.errorCode != null || reviewRun.errorCode != null) {
    throw new Error("Governed Case requires clean successful model-driven source and review runs");
  }
  if (!UUID.test(sourceDocument?.id ?? "")
    || sourceDocument.id === reportDocument?.id
    || !UUID.test(reportDocument?.id ?? "")
    || reportDocument?.format !== "json") {
    throw new Error("Governed Case needs a separate persisted JSON reviewer document");
  }
  if (caseState?.status !== "done" || summary?.current !== true
    || summary?.provenanceCurrent !== true
    || summary?.reviewerAgentId !== reviewerAgentId
    || summary?.citedDocumentCount !== 1
    || summary?.executionAuthorized !== false) {
    throw new Error("Governed Case original completion and current signed review were not both verified");
  }
  for (const run of [sourceRun, reviewRun]) {
    const cost = run.usageJson?.costUsd;
    if (cost != null && cost !== 0) throw new Error("Governed Case refuses nonzero reported model cost");
  }
  const measuredZeroCost = [sourceRun, reviewRun].every(run => run.usageJson?.costUsd === 0);
  return {
    caseDone: true, twoDistinctRealAgentRuns: true,
    verifierAuthoredStructuredReport: true, independentCurrentSourceCitation: true,
    boardSummaryCurrent: true, reportedCostUsd: measuredZeroCost ? 0 : null,
  };
}

async function request(base, method, route, body) {
  const res = await fetch(new URL("/api/" + route, base), {
    method, redirect: "error", signal: AbortSignal.timeout(15_000),
    ...(body === undefined ? {} : {
      headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }),
  });
  let value;
  try { value = await res.json(); } catch { value = null; }
  if (!res.ok) {
    // Untrusted provider/server error body may carry tokens: never print it.
    throw new Error("Governed Case private API rejected " +
      route.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/ig, "<id>") +
      " with HTTP " + res.status);
  }
  return value;
}
async function waitFor(task, label, milliseconds = 165_000) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) {
    const result = await task();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 1_500));
  }
  throw new Error("Governed Case timed out waiting for " + label);
}
async function listIssueDocs(base, issueId) {
  const rows = await request(base, "GET", "issues/" + issueId + "/documents");
  return Array.isArray(rows) ? rows : rows?.documents ?? [];
}
async function readRun(base, id) {
  return await request(base, "GET", "heartbeat-runs/" + id);
}
async function waitAssignment(base, companyId, agentId, issueId) {
  return await waitFor(async () => {
    const rows = await request(base, "GET", "companies/" + companyId +
      "/heartbeat-runs?agentId=" + agentId + "&limit=50");
    return selectSingleAssignmentRun(rows, { agentId, issueId });
  }, "exact assigned heartbeat", 80_000);
}
async function waitRunFinish(base, assignment) {
  const terminal = await waitFor(async () => {
    const run = await readRun(base, assignment.id);
    return observeHeartbeatQaStatus(run).done ? run : null;
  }, "agent completion", 200_000);
  assertHeartbeatQaSucceeded(terminal);
  return terminal;
}
async function waitRun(base, companyId, agentId, issueId) {
  return await waitRunFinish(base, await waitAssignment(base, companyId, agentId, issueId));
}

/**
 * An ordinary issue can be scheduled for another automation run the instant
 * its assignment run completes. Accept a board handoff ONLY while its exact
 * original assignment run still owns the issue AND has already persisted the
 * source comment; never capture a speculative later automation run.
 */
export function requireLiveSourceHandoffOwner({ issue, assignmentRun, sourceCommentId }) {
  if (!UUID.test(assignmentRun?.id ?? "") ||
    !UUID.test(sourceCommentId ?? "") ||
    !UUID.test(issue?.id ?? "") ||
    issue.executionRunId !== assignmentRun.id ||
    issue.status === "done" ||
    !["running", "executing"].includes(assignmentRun.status)) {
    throw new Error("Refusing governed Case handoff from another or completed source run");
  }
  return true;
}


export async function runGovernedCaseFreeE2e(env = process.env) {
  const { base, home, model } = qualifyGovernedCaseQa(env);
  requireNativeCaseQaHost();
  if (isOpenRouterFreeQaModel(model)) await admitOpenRouterZeroCostQa({ model, env });
  // OpenCode model admission is required independently by the source runtime;
  // no claim is made based solely on an unverified model catalog listing.
  await request(base, "PATCH", "instance/settings/experimental", { enableCases: true });
  const health = await request(base, "GET", "health");
  if (health.status !== "ok" || health.deploymentExposure !== "private") {
    throw new Error("Governed Case refuses non-private source server");
  }
  const company = await request(base, "POST", "companies", {
    name: "Bostan Synthetic Governed QA " + randomUUID(),
  });
  const workspace = path.join(home, ".bostan", "case-agent-workspaces");
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  async function createAgent(name, role, suffix) {
    const dir = path.join(workspace, suffix);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const agent = await request(base, "POST", "companies/" + company.id + "/agents", {
      name, role, adapterType: "paperclip_runner", runner: "paperclip",
      adapterConfig: nativeGovernedCaseAgentConfig({
        model, workspace: dir,
      }), budgetMonthlyCents: 0,
    });
    await waitFor(async () => {
      const current = await request(base, "GET", "agents/" + agent.id);
      if (["failed", "terminated"].includes(current.lifecycleState)) {
        throw new Error("Governed Case agent failed private lifecycle qualification");
      }
      return current.lifecycleState === "ready" ? current : null;
    }, "real free agent readiness", 180_000);
    return agent;
  }
  const specialist = await createAgent("Bostan Case Source Specialist", "engineer", "source");
  const verifier = await createAgent("Bostan Independent Case Verifier", "engineer", "verifier");
  const source = "Bostan isolated QA source. The correct synthetic audit token is A7. " +
    "The recorded work is safe-only, with no live external effects. Test document revision provenance.";
  const created = await request(base, "POST", "companies/" + company.id + "/case-handoffs", {
    idempotencyKey: "bostan-case-seed-" + randomUUID(),
    case: { create: {
      caseType: "verification", title: "Bostan free independent review synthetic Case",
      summary: [
        "Synthetic Bostan governed Case source-worker QA. In this assigned task,",
        "Read the original bostan-source document using get_task and read_task_document;",
        "its synthetic evidence token is A7. Use comment_on_task to persist exactly",
        "BOSTAN_CLEAN_RUN_PASS, then read the task and source back.",
        "DO NOT mark the Case or issue Done; independent verification must follow.",
        "Do not call shell/curl, remote providers or access unrelated files/data.",
      ].join(" "),
      fields: { bostanIndependentVerificationRequired: true },
    } },
    toAgentId: specialist.id, phase: "implementation",
    instructions: buildNativeSourceCaseInstructions(),
    workflow_document_text: "implementation: assigned specialist reads synthetic evidence; " +
      "verification: a different agent reads source snapshot, produces a JSON report, " +
      "then terminal review must be accepted by the local board before task Done.",
    initialDocuments: [{ key: "bostan-source", title: "Synthetic source evidence", body: source }],
  });
  const issueId = created.taskId, caseId = created.caseId;
  if (!UUID.test(issueId) || !UUID.test(caseId)) throw new Error("No persisted Case and task identity");
  const sourceAssignment = await waitAssignment(base, company.id, specialist.id, issueId);
  const commentCheck = await waitFor(async () => {
    const currentRun = await readRun(base, sourceAssignment.id);
    // A run that already ended before the comment became visible is not safe
    // to hand off; the scheduler may already own a DIFFERENT automation run.
    if (observeHeartbeatQaStatus(currentRun).done) {
      throw new Error("Source agent finished before an exact-run handoff could be admitted");
    }
    const currentIssue = await request(base, "GET", "issues/" + issueId);
    const commentsResult = await request(base, "GET", "issues/" + issueId + "/comments");
    const comments = Array.isArray(commentsResult) ? commentsResult : commentsResult.comments ?? [];
    let commentId = null;
    try {
      commentId = requirePersistedRunComment({ comments, agentId: specialist.id,
        runId: sourceAssignment.id, marker: SOURCE_MARKER }).commentId;
    } catch { return null; }
    requireLiveSourceHandoffOwner({
      issue: currentIssue, assignmentRun: currentRun, sourceCommentId: commentId,
    });
    return { currentIssue, sourceCommentId: commentId };
  }, "first source comment while original assignment owns work", 135_000);
  const originalIssue = commentCheck.currentIssue;
  const originalSource = (await listIssueDocs(base, issueId)).find(doc => doc.key === "bostan-source");
  if (!UUID.test(originalSource?.id ?? "")) throw new Error("Governed Case source document missing");
  const handoff = await request(base, "POST", "companies/" + company.id + "/case-handoffs", {
    idempotencyKey: "bostan-case-independent-" + randomUUID(),
    case: { id: caseId }, expectedHandoffVersion: created.handoffVersion,
    expectedIssueStatusVersion: originalIssue.statusVersion,
    toAgentId: verifier.id, phase: "verification",
    instructions: buildNativeVerifierCaseInstructions({
      companyId: company.id, issueId, documentId: originalSource.id,
    }),
  });
  if (handoff.caseId !== caseId || handoff.destinationKind !== "agent") {
    throw new Error("Independent Case handoff was not persisted");
  }
  // Wait for the ORIGINAL specialist run to finish; only then is the
  // server permitted to release this particular handoff to the verifier.
  const sourceRun = await waitRunFinish(base, sourceAssignment);
  const reviewRun = await waitRun(base, company.id, verifier.id, issueId);
  const documents = await listIssueDocs(base, issueId);
  const reportDocument = documents.find(doc => doc.key === "bostan-verification");
  if (!reportDocument) throw new Error("Real model never persisted authenticated Case reviewer report");
  const currentIssue = await request(base, "GET", "issues/" + issueId);
  const currentCase = await request(base, "GET", "cases/" + caseId);
  const terminal = await request(base, "POST", "companies/" + company.id + "/case-handoffs", {
    to: "done", case: { id: caseId }, idempotencyKey: "bostan-case-terminal-" + randomUUID(),
    expectedHandoffVersion: currentCase.handoffVersion,
    expectedIssueStatusVersion: currentIssue.statusVersion,
    instructions: "Conclude only after an authenticated independent verifier report and current original source are proven",
  });
  if (terminal.destinationKind !== "done") throw new Error("Case terminal authority refused");
  await request(base, "PATCH", "issues/" + issueId, { status: "done" });
  const finalCase = await request(base, "GET", "cases/" + caseId);
  const summary = await request(base, "GET", "cases/" + caseId + "/bostan-verification");
  const receipt = verifyGovernedCaseReceipt({
    caseState: finalCase, sourceRun, reviewRun,
    implementationAgentId: specialist.id, reviewerAgentId: verifier.id,
    sourceDocument: originalSource, reportDocument, summary,
  });
  console.log("BOSTAN_REAL_FREE_GOVERNED_CASE_PASS " + JSON.stringify({
    ...receipt, model, companyId: company.id, caseId, issueId,
    specialistRunId: sourceRun.id, reviewerRunId: reviewRun.id,
    reviewerDocumentId: reportDocument.id,
  }));
  return receipt;
}
