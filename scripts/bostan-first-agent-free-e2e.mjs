import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "opencode/deepseek-v4.1-flash-free";
const FREE_QA_MODELS = new Set([DEFAULT_MODEL, "opencode/beam-free"]);
export function qualifyFreeQaModel(value) {
  const model = value || DEFAULT_MODEL;
  if (!FREE_QA_MODELS.has(model)) throw new Error("Only explicitly permitted free test models are allowed");
  return model;
}
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

const MARKER = "BOSTAN_CLEAN_RUN_PASS";
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
async function waitFor(check, { timeoutMs, intervalMs = 3_000, label }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value.done) return value.result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Bostan QA timed out waiting for " + label);
}
export async function runFirstAgentFreeE2e(env = process.env) {
  const { base, home } = qualifyDisposableFirstAgentScope({
    url: env.BOSTAN_E2E_URL,
    home: env.BOSTAN_E2E_DISPOSABLE_HOME,
    confirmed: env.BOSTAN_E2E_CONFIRM_TEMP_DATA,
    onlineModelApproved: env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL,
  });
  const model = qualifyFreeQaModel(env.BOSTAN_E2E_FREE_MODEL);
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
  await waitFor(async () => {
    const current = await requestJson(base, "agents/" + agent.id);
    if (current.lifecycleState === "ready") return { done: true, result: current };
    if (["failed", "terminated"].includes(current.lifecycleState)) {
      throw new Error("Bostan first agent did not pass lifecycle verification: " + current.lifecycleState);
    }
    return { done: false };
  }, { timeoutMs: 90_000, label: "agent lifecycle ready" });
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
    if (["succeeded", "failed", "timed_out", "cancelled"].includes(current.status)) {
      return { done: true, result: current };
    }
    return { done: false };
  }, { timeoutMs: 175_000, label: "agent heartbeat terminal status" });
  const finalIssue = await requestJson(base, "issues/" + issue.id);
  const commentResult = await requestJson(base, "issues/" + issue.id + "/comments");
  const comments = Array.isArray(commentResult) ? commentResult : commentResult.comments ?? [];
  const hasMarker = comments.some((entry) =>
    String(entry.body ?? entry.content ?? "").includes(MARKER));
  const clean = run.status === "succeeded" && run.exitCode === 0
    && run.errorCode == null && finalIssue.status === "done" && hasMarker;
  if (!clean) {
    throw new Error("Bostan first agent did not qualify clean completion: " +
      JSON.stringify({ runStatus: run.status, exitCode: run.exitCode,
        errorCode: run.errorCode, issueStatus: finalIssue.status, hasMarker }));
  }
  console.log("Bostan first real free agent E2E PASS: " +
    JSON.stringify({ model, companyId: company.id, agentId: agent.id, issueId: issue.id,
      runId: run.id, runStatus: run.status, exitCode: run.exitCode,
      issueStatus: finalIssue.status, exactMarkerFound: hasMarker,
      reportedCostUsd: run.usageJson?.costUsd ?? null }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runFirstAgentFreeE2e();
}
