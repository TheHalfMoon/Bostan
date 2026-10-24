import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { qualifyFreeQaModel } from "./bostan-first-agent-free-e2e.mjs";

const REPLY = "BOSTAN_ISOLATED_FREE_MODEL_READY";
const MAX_OUTPUT = 256 * 1024;

export function isolatedOpenCodeAdmissionEnvironment(home, original = process.env) {
  if (!path.isAbsolute(home) || !fs.statSync(home).isDirectory()) {
    throw new Error("A precreated absolute disposable OpenCode HOME is required");
  }
  const env = {};
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT",
    "SYSTEMDRIVE", "HOMEDRIVE", "PROCESSOR_ARCHITECTURE", "LANG"]) {
    if (typeof original[key] === "string") env[key] = original[key];
  }
  for (const name of ["config", "cache", "data", "tmp", "roaming", "local"]) {
    fs.mkdirSync(path.join(home, name), { recursive: true, mode: 0o700 });
  }
  return {
    ...env,
    HOME: home, USERPROFILE: home,
    APPDATA: path.join(home, "roaming"), LOCALAPPDATA: path.join(home, "local"),
    XDG_CONFIG_HOME: path.join(home, "config"),
    XDG_DATA_HOME: path.join(home, "data"),
    XDG_CACHE_HOME: path.join(home, "cache"),
    TMP: path.join(home, "tmp"),
    TEMP: path.join(home, "tmp"),
    TMPDIR: path.join(home, "tmp"),
    NO_COLOR: "1", DO_NOT_TRACK: "1",
  };
}

export function freeModelResponseMatches(stdout, expected = REPLY) {
  return stdout.split(/\r?\n/).some(line => {
    try {
      const event = JSON.parse(line);
      return event.type === "text" && event.part?.text?.trim() === expected;
    } catch { return false; }
  });
}

function appendBounded(old, data) {
  if (old.length >= MAX_OUTPUT) return old;
  return (old + data).slice(0, MAX_OUTPUT);
}

async function terminateProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform !== "win32") {
    child.kill("SIGKILL");
    return;
  }
  await new Promise(resolve => {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore", windowsHide: true,
    });
    killer.once("error", () => { try { child.kill(); } catch {} resolve(); });
    killer.once("exit", resolve);
  });
}

export async function runBoundedAdmissionChild({
  executable, args, cwd, env, timeoutMs = 75_000,
}) {
  if (!executable || !path.isAbsolute(executable) || !fs.statSync(executable).isFile()
    || !path.isAbsolute(cwd) || !fs.statSync(cwd).isDirectory()
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 90_000) {
    throw new Error("Invalid bounded free-model admission command");
  }
  return await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(executable, args, {
        cwd, env, windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) { reject(error); return; }
    let stdout = "", stderr = "", timedOut = false, settled = false;
    child.stdout.on("data", b => { stdout = appendBounded(stdout, b.toString()); });
    child.stderr.on("data", b => { stderr = appendBounded(stderr, b.toString()); });
    const timer = setTimeout(() => {
      timedOut = true;
      void terminateProcessTree(child);
    }, timeoutMs);
    const finish = (error, code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve({ exitCode: code, signal, timedOut, stdout, stderr });
    };
    child.once("error", error => finish(error));
    child.once("close", (code, signal) => finish(null, code, signal));
  });
}

export async function admitFreeOpenCodeModel({
  model, executable, parent, env = process.env, timeoutMs = 75_000,
}) {
  const qualifiedModel = qualifyFreeQaModel(model);
  if (!path.isAbsolute(parent) || !fs.realpathSync(parent).startsWith(fs.realpathSync(os.tmpdir()) + path.sep)) {
    throw new Error("Refusing free-model admission outside disposable TEMP profile");
  }
  if (env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL !== "1") {
    throw new Error("Explicit free online-model permission is required");
  }
  if (!executable || !path.isAbsolute(executable)) {
    throw new Error("Set BOSTAN_E2E_OPENCODE_EXE to a trusted absolute native OpenCode executable");
  }
  const root = fs.mkdtempSync(path.join(parent, "opencode-free-preflight-"));
  try {
    const home = path.join(root, "home");
    const cwd = path.join(root, "empty-workspace");
    fs.mkdirSync(home, { mode: 0o700 });
    fs.mkdirSync(cwd, { mode: 0o700 });
    const result = await runBoundedAdmissionChild({
      executable, cwd, env: isolatedOpenCodeAdmissionEnvironment(home, env),
      args: ["run", "--standalone", "--format", "json", "--model", qualifiedModel,
        "Reply exactly " + REPLY + ". Do not use tools."],
      timeoutMs,
    });
    if (result.timedOut) throw new Error("OpenCode free model admission timed out; no Bostan agent was created");
    if (result.exitCode !== 0 || !freeModelResponseMatches(result.stdout)) {
      throw new Error("OpenCode free model admission did not return the exact model reply");
    }
    return { qualified: true, model: qualifiedModel };
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = process.env;
  if (env.BOSTAN_E2E_CONFIRM_TEMP_DATA !== "1" || env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL !== "1") {
    throw new Error("Explicit disposable-data confirmation and free online-model opt-in are required");
  }
  const parent = env.BOSTAN_E2E_DISPOSABLE_HOME;
  if (!parent) throw new Error("Set BOSTAN_E2E_DISPOSABLE_HOME to a pre-existing TEMP directory");
  const result = await admitFreeOpenCodeModel({
    parent, model: env.BOSTAN_E2E_FREE_MODEL,
    executable: env.BOSTAN_E2E_OPENCODE_EXE, env,
  });
  console.log("Bostan native free-model admission PASS: " + result.model);
}
