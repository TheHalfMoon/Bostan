import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const terminal = new Set(["succeeded", "failed", "timed_out", "cancelled", "interrupted"]);
function phase(name) { console.log("BOSTAN_INSTALLED_TASK_PHASE " + name); }
function client(page) {
  const origin = new URL(page.url()).origin;
  return async (method, route, data) => {
    const url = new URL(route, origin);
    assert.equal(url.origin, origin, "Installed task API must stay on its application origin");
    const response = await page.request[method](url.href, {
      ...(data === undefined ? {} : { data }),
      ...(method.toUpperCase() === "GET" ? {} : { headers: { origin } }),
      timeout: 15000,
    });
    if (!response.ok()) {
      const body = await response.json().catch(() => null);
      const code = typeof body?.code === "string" && /^[a-z0-9_.-]{1,80}$/i.test(body.code) ? ` code=${body.code}` : "";
      assert.fail(`Installed task API refused ${method} (${response.status()})${code}`);
    }
    return response;
  };
}
async function until(read, accept, label, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await delay(250);
  }
  throw Error("Installed task condition timed out: " + label);
}
async function stopped(pid) {
  await until(async () => {
    try { process.kill(pid, 0); return false; }
    catch (error) { return error.code === "ESRCH"; }
  }, Boolean, "provider child termination", 10000);
}

/** Real API/process/storage CI acceptance. Does not qualify model execution. */
export async function runInstalledTaskJourney({ page, companyId, reportsTo = null, executable, workspace }) {
  assert.equal(fs.realpathSync(path.dirname(workspace)), path.dirname(workspace));
  fs.mkdirSync(workspace, { mode: 0o700 });
  fs.copyFileSync(fileURLToPath(new URL("./installed-process-provider.mjs", import.meta.url)), path.join(workspace, "provider.mjs"));
  const marker = "BOSTAN_DESKTOP_ARTIFACT_" + randomBytes(24).toString("hex");
  fs.writeFileSync(path.join(workspace, "input.txt"), marker, { flag: "wx", mode: 0o600 });
  const request = client(page);
  const json = async (method, route, data) => (await request(method, route, data)).json();
  async function detailedTaskRuns(issueId) {
    const runs = await json("get", `/api/companies/${companyId}/heartbeat-runs?agentId=${agentId}`);
    assert.ok(Array.isArray(runs));
    const details = [];
    for (const run of runs.filter(item => item.issueId === issueId)) {
      // List rows intentionally contain only summary context, not retry lineage.
      details.push(await json("get", `/api/heartbeat-runs/${run.id}`));
    }
    return details;
  }
  const hire = await json("post", `/api/companies/${companyId}/agent-hires`, {
    name: "Desktop CI Process Worker", role: reportsTo ? "engineer" : "ceo", reportsTo,
    adapterType: "process", runner: "legacy",
    adapterConfig: { command: executable, args: [path.join(workspace, "provider.mjs")], cwd: workspace,
      timeoutSec: 30, graceSec: 1, env: { ELECTRON_RUN_AS_NODE: "1", BOSTAN_DESKTOP_CI_PROVIDER: "1" } },
    runtimeConfig: { heartbeat: { enabled: false, intervalSec: 0 } },
  });
  const agentId = hire.agent?.id;
  assert.equal(typeof agentId, "string");
  if (hire.approval) await json("post", `/api/approvals/${hire.approval.id}/approve`, { decisionNote: "Owned deterministic desktop CI provider only." });
  let agent = await until(() => json("get", `/api/agents/${agentId}`),
    item => !["preparing", "verifying", "resuming", "pending_approval"].includes(item.lifecycleState), "process provider verification");
  assert.equal(agent.lifecycleError ?? null, null);
  if (agent.lifecycleState === "paused") agent = await json("post", `/api/agents/${agentId}/resume`, {});
  await until(() => json("get", `/api/agents/${agentId}`), item => item.lifecycleState === "ready" && ["idle", "active"].includes(item.status), "process provider ready");
  phase("provider_ready");

  async function configureTimeout(timeoutSec) {
    const current = await json("get", `/api/agents/${agentId}`);
    await json("patch", `/api/agents/${agentId}`, { adapterConfig: { ...current.adapterConfig, timeoutSec } });
    await until(() => json("get", `/api/agents/${agentId}`), item => item.lifecycleState === "ready"
      && item.adapterConfig?.timeoutSec === timeoutSec, "provider timeout configuration ready");
  }

  async function task(mode, title) {
    const issue = await json("post", `/api/companies/${companyId}/issues`, { title, status: "backlog" });
    fs.writeFileSync(path.join(workspace, "job.json"), JSON.stringify({ issueId: issue.id, mode }), { mode: 0o600 });
    await json("patch", `/api/issues/${issue.id}`, { status: "todo", assigneeAgentId: agentId });
    const run = await until(async () => {
      const runs = await json("get", `/api/companies/${companyId}/heartbeat-runs?agentId=${agentId}`);
      assert.ok(Array.isArray(runs));
      return runs.find(item => item.issueId === issue.id);
    }, Boolean, "automatic assigned-task wake");
    return { issue, run };
  }
  const waitTerminal = id => until(() => json("get", `/api/heartbeat-runs/${id}`), item => terminal.has(item.status), "task terminal result");
  const started = (id, issueId) => until(async () => {
    const filename = path.join(workspace, "runs", id + ".json");
    if (!fs.existsSync(filename)) return null;
    const receipt = JSON.parse(fs.readFileSync(filename, "utf8"));
    assert.equal(receipt.issueId, issueId);
    assert.ok(Number.isSafeInteger(receipt.pid) && receipt.pid > 0);
    return receipt;
  }, Boolean, "actual provider child start");
  const artifactTask = await task("artifact", "Read and attach deterministic desktop proof");
  const success = await waitTerminal(artifactTask.run.id);
  assert.equal(success.status, "succeeded");
  assert.equal(success.resultJson?.effectiveTimeoutSec, 30);
  assert.equal(fs.readFileSync(path.join(workspace, "artifacts", artifactTask.issue.id + ".txt"), "utf8"), marker);
  const output = (success.resultJson?.stdout ?? "").trim().split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } })
    .find(item => item?.type === "bostan-ci-process-artifact");
  assert.equal(output?.issueId, artifactTask.issue.id);
  assert.equal(output?.runId, success.id);
  const attachments = await json("get", `/api/issues/${artifactTask.issue.id}/attachments`);
  const attachment = attachments.find(item => item.id === output.attachmentId);
  assert.ok(attachment?.contentPath);
  const downloaded = await request("get", attachment.contentPath);
  assert.equal(downloaded.status(), 200);
  assert.equal((await downloaded.body()).toString(), marker);
  const products = await json("get", `/api/issues/${artifactTask.issue.id}/work-products`);
  assert.ok(products.some(item => item.id === output.workProductId && item.metadata?.attachmentId === attachment.id));
  await json("patch", `/api/issues/${artifactTask.issue.id}`, { status: "done" });
  phase("artifact_verified");

  await configureTimeout(15);
  const cancelTask = await task("hold", "Cancel an actually running desktop process");
  const cancelProcess = await started(cancelTask.run.id, cancelTask.issue.id);
  assert.ok(Number.isSafeInteger(cancelProcess.pid) && cancelProcess.pid > 0);
  await json("post", `/api/heartbeat-runs/${cancelTask.run.id}/cancel`, {});
  assert.equal((await waitTerminal(cancelTask.run.id)).status, "cancelled");
  await stopped(cancelProcess.pid);
  phase("cancelled_child_stopped");
  await json("patch", `/api/issues/${cancelTask.issue.id}`, { status: "cancelled" });

  const timeoutTask = await task("hold", "Time out then retry the exact desktop task");
  const timedProcess = await started(timeoutTask.run.id, timeoutTask.issue.id);
  assert.equal(timedProcess.mode, "hold");
  assert.ok(Number.isSafeInteger(timedProcess.pid) && timedProcess.pid > 0);
  const timedOut = await waitTerminal(timeoutTask.run.id);
  assert.equal(timedOut.status, "timed_out");
  assert.equal(timedOut.resultJson?.effectiveTimeoutSec, 15);
  await stopped(timedProcess.pid);
  phase("timed_out_child_stopped");
  await configureTimeout(30);
  fs.writeFileSync(path.join(workspace, "job.json"), JSON.stringify({ issueId: timeoutTask.issue.id, mode: "artifact" }), { mode: 0o600 });
  // Acceptance records intent; an opaque process still requires truthful
  // operator evidence before replay. Do not bypass this with an agent wake.
  const retryBody = { idempotencyKey: randomUUID(), observedRunId: timeoutTask.run.id };
  const retry = await json("post", `/api/issues/${timeoutTask.issue.id}/retry`, retryBody);
  assert.equal(retry.accepted, true); assert.equal(retry.stale, false);
  phase("task_retry_accepted");
  assert.equal(typeof retry.requestId, "string");
  const repeatedRetry = await json("post", `/api/issues/${timeoutTask.issue.id}/retry`, retryBody);
  assert.equal(repeatedRetry.requestId, retry.requestId); assert.equal(repeatedRetry.accepted, true);
  const recovery = await until(() => json("get", `/api/issues/${timeoutTask.issue.id}/recovery-actions`),
    item => item.actions?.some(action => action.evidence?.runId === timeoutTask.run.id
      && action.evidence?.automaticRecovery?.replay === "blocked"), "opaque process reconciliation hold");
  const action = recovery.actions.find(item => item.evidence?.runId === timeoutTask.run.id
    && item.evidence?.automaticRecovery?.replay === "blocked");
  const blockedRuns = await detailedTaskRuns(timeoutTask.issue.id);
  assert.equal(blockedRuns.some(item => item.contextSnapshot?.taskRetryRequestId === retry.requestId), false);
  assert.equal(fs.existsSync(path.join(workspace, "artifacts", timeoutTask.issue.id + ".txt")), false);
  // Specific to this instrumented hold program: its only effect is a PID/mode
  // receipt. No task/API work occurs in that branch, and its child is gone.
  const resolution = await json("post", `/api/issues/${timeoutTask.issue.id}/recovery-actions/resolve`, {
    actionId: action.id, outcome: "restored", sourceIssueStatus: "todo",
    resolutionNote: "Reconciled the owned deterministic CI hold process before retry.",
    executionReconciliation: { runId: timeoutTask.run.id, providerStopped: true, actionOutcome: "not_performed",
      outcomeEvidence: "The owned CI program recorded hold mode and its PID; that process is stopped. The hold branch performs no task or API work, and no task artifact exists. Existing workspace contents are preserved." },
  });
  assert.equal(resolution.recoveryAction?.id, action.id);
  phase("operator_reconciliation_recorded");
  const reconciledRetry = await json("post", `/api/issues/${timeoutTask.issue.id}/retry`, retryBody);
  assert.equal(reconciledRetry.requestId, retry.requestId); assert.equal(reconciledRetry.accepted, true);
  const isContinuation = item => item.issueId === timeoutTask.issue.id
    && item.contextSnapshot?.previousRunId === timeoutTask.run.id
    && (item.contextSnapshot?.taskRetryRequestId === retry.requestId
      || (item.contextSnapshot?.recoveryActionId === action.id
        && item.contextSnapshot?.retryOfRunId === timeoutTask.run.id));
  const successor = await until(async () => {
    const runs = await detailedTaskRuns(timeoutTask.issue.id);
    return runs.find(isContinuation);
  }, Boolean, "durable retry successor");
  const retryId = successor.id;
  assert.equal(typeof retryId, "string"); assert.notEqual(retryId, timeoutTask.run.id);
  const retried = await waitTerminal(retryId);
  assert.equal(retried.status, "succeeded"); assert.equal(retried.issueId, timeoutTask.issue.id);
  assert.equal(retried.resultJson?.effectiveTimeoutSec, 30);
  assert.equal(retried.contextSnapshot?.previousRunId, timeoutTask.run.id);
  assert.ok(isContinuation(retried), "Continuation must retain exact task/source and authorized delivery identity");
  await json("patch", `/api/issues/${timeoutTask.issue.id}`, { status: "done" });
  const finalRuns = await detailedTaskRuns(timeoutTask.issue.id);
  const effective = finalRuns.filter(item => isContinuation(item)
    && (item.startedAt || item.status === "succeeded"));
  assert.deepEqual(effective.map(item => item.id), [retryId], "Only one authorized continuation may execute");
  phase("exact_retry_succeeded");
  return { companyId, agentId, issueId: artifactTask.issue.id, successRunId: success.id,
    cancelRunId: cancelTask.run.id, timeoutRunId: timeoutTask.run.id, retryRunId: retryId,
    attachmentId: attachment.id, contentPath: attachment.contentPath, workProductId: output.workProductId, marker };
}

export async function assertInstalledTaskPersistence(page, receipt) {
  const request = client(page);
  for (const [id, status] of [[receipt.successRunId, "succeeded"], [receipt.cancelRunId, "cancelled"], [receipt.timeoutRunId, "timed_out"], [receipt.retryRunId, "succeeded"]]) {
    const run = await (await request("get", `/api/heartbeat-runs/${id}`)).json();
    assert.equal(run.status, status);
  }
  const issue = await (await request("get", `/api/issues/${receipt.issueId}`)).json();
  assert.equal(issue.status, "done");
  assert.equal((await (await request("get", receipt.contentPath)).body()).toString(), receipt.marker);
  const products = await (await request("get", `/api/issues/${receipt.issueId}/work-products`)).json();
  assert.ok(products.some(item => item.id === receipt.workProductId && item.metadata?.attachmentId === receipt.attachmentId));
  phase("restart_persistence_verified");
}
