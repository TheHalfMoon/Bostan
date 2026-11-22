import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qualifyLocalOpenCodeQaModel } from "./bostan-free-model-policy.mjs";
import {
  freeModelResponseMatches,
  isolatedOpenCodeAdmissionEnvironment,
  runBoundedAdmissionChild,
} from "./bostan-opencode-free-admission.mjs";

export const LOCAL_OPENCODE_QA_MODEL = "ollama/qwen2.5-coder:1.5b";
export const LOCAL_OLLAMA_HOST = "http://127.0.0.1:11434";
// SHA-256 of the exact official Ollama registry manifest; /api/tags returns the hex digest without its algorithm prefix.
export const LOCAL_OLLAMA_MANIFEST_DIGEST = "d7372fd828518a4d38b1eb196c673c31a85f2ed302b3d1e406c4c2d1b64a0668";
const REPLY = "BOSTAN_LOCAL_MODEL_READY";

export function qualifyLoopbackOllamaHost(value = LOCAL_OLLAMA_HOST) {
  let host;
  try { host = new URL(value); } catch { throw new Error("A local Ollama loopback endpoint is required"); }
  if (host.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(host.hostname)
    || host.port !== "11434" || host.pathname !== "/" || host.search || host.hash
    || host.username || host.password) {
    throw new Error("Ollama endpoint must be the private loopback listener on port 11434");
  }
  return LOCAL_OLLAMA_HOST;
}

export async function inspectLocalOllamaModel({
  model = LOCAL_OPENCODE_QA_MODEL,
  endpoint = LOCAL_OLLAMA_HOST,
  fetchImpl = globalThis.fetch,
} = {}) {
  qualifyLocalOpenCodeQaModel(model);
  const host = qualifyLoopbackOllamaHost(endpoint);
  const response = await fetchImpl(new URL("/api/tags", host), { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("Local Ollama model inventory is unavailable");
  const body = await response.json();
  const entry = Array.isArray(body?.models)
    ? body.models.find(item => item?.name === "qwen2.5-coder:1.5b")
    : undefined;
  if (!entry || entry.digest !== LOCAL_OLLAMA_MANIFEST_DIGEST
    || !Number.isSafeInteger(entry.size) || entry.size < 500_000_000 || entry.size > 2_000_000_000) {
    throw new Error("The pinned local Qwen2.5 Coder 1.5B model is not installed");
  }
  return { model, digest: entry.digest, size: entry.size, endpoint: host };
}

function temporaryParent(parent) {
  return path.isAbsolute(parent)
    && fs.realpathSync(parent).startsWith(fs.realpathSync(os.tmpdir()) + path.sep);
}

export async function admitLocalOpenCodeModel({
  model = LOCAL_OPENCODE_QA_MODEL,
  executable,
  parent,
  env = process.env,
  timeoutMs = 75_000,
}) {
  const qualifiedModel = qualifyLocalOpenCodeQaModel(model);
  if (env.BOSTAN_E2E_ALLOW_LOCAL_MODEL !== "1" || env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL === "1") {
    throw new Error("Explicit local-only model permission is required");
  }
  if (!parent || !temporaryParent(parent)) throw new Error("Refusing local-model admission outside disposable TEMP profile");
  if (!executable || !path.isAbsolute(executable) || !fs.statSync(executable).isFile()) {
    throw new Error("Set BOSTAN_E2E_OPENCODE_EXE to a trusted absolute native OpenCode executable");
  }
  const modelInfo = await inspectLocalOllamaModel({ model: qualifiedModel, endpoint: env.OLLAMA_HOST || LOCAL_OLLAMA_HOST });
  const root = fs.mkdtempSync(path.join(parent, "opencode-local-preflight-"));
  try {
    const home = path.join(root, "home");
    const cwd = path.join(root, "empty-workspace");
    fs.mkdirSync(home, { mode: 0o700 });
    fs.mkdirSync(cwd, { mode: 0o700 });
    const childEnv = isolatedOpenCodeAdmissionEnvironment(home, env);
    childEnv.OLLAMA_HOST = modelInfo.endpoint;
    const result = await runBoundedAdmissionChild({
      executable,
      cwd,
      env: childEnv,
      args: ["run", "--standalone", "--format", "json", "--model", qualifiedModel,
        "Reply exactly " + REPLY + ". Do not use tools."],
      timeoutMs,
    });
    if (result.timedOut) throw new Error("Local OpenCode model admission timed out before Bostan agent creation");
    if (result.exitCode !== 0 || !freeModelResponseMatches(result.stdout, REPLY)) {
      throw new Error("Local OpenCode model did not return the exact admission reply");
    }
    return { qualified: true, model: qualifiedModel, digest: modelInfo.digest, costUsd: 0 };
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = process.env;
  if (env.BOSTAN_E2E_CONFIRM_TEMP_DATA !== "1") throw new Error("Explicit disposable-data confirmation is required");
  const parent = env.BOSTAN_E2E_DISPOSABLE_HOME;
  if (!parent) throw new Error("Set BOSTAN_E2E_DISPOSABLE_HOME to a pre-existing TEMP directory");
  const result = await admitLocalOpenCodeModel({
    parent,
    model: env.BOSTAN_E2E_FREE_MODEL || LOCAL_OPENCODE_QA_MODEL,
    executable: env.BOSTAN_E2E_OPENCODE_EXE,
    env,
  });
  console.log("Bostan local OpenCode model admission PASS: " + result.model + " " + result.digest);
}
