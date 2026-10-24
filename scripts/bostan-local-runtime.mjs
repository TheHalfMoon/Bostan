import { randomBytes } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { inspectRuntimeLock, removeStoppedRuntimeLock } from "./bostan-runtime-recovery.mjs";

const exec = promisify(execFile);
export const REPO = fileURLToPath(new URL("../", import.meta.url));
const MARKER = "bostan-managed-source-runtime-v1";
const TOOLS = ["initdb", "pg_ctl", "psql", "createdb"];

export function executable(name, env = process.env) {
  for (const dir of (env.PATH || "").split(path.delimiter)) {
    if (!path.isAbsolute(dir)) continue;
    const candidate = path.join(dir, name);
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch {}
  }
  return null;
}
function entry(p, directory) {
  try {
    const s = fs.lstatSync(p);
    if (s.isSymbolicLink() || (directory ? !s.isDirectory() : !s.isFile() || s.nlink !== 1)
      || (typeof process.getuid === "function" && s.uid !== process.getuid())) {
      throw new Error("Unsafe Bostan local runtime filesystem entry: " + p);
    }
    return true;
  } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}
function directory(p) {
  if (entry(p, true)) return;
  if (!entry(path.dirname(p), true)) throw new Error("Unsafe Bostan parent path");
  fs.mkdirSync(p, { mode: 0o700 });
  if (!entry(p, true)) throw new Error("Bostan failed to create secure directory");
}
function secret(p) {
  if (entry(p, false)) {
    if (fs.statSync(p).mode & 0o077) throw new Error("Insecure Bostan secret permissions");
    const value = fs.readFileSync(p, "utf8").trim();
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error("Invalid Bostan secret");
    return value;
  }
  const value = randomBytes(32).toString("hex");
  fs.writeFileSync(p, value + "\n", { mode: 0o600, flag: "wx" });
  return value;
}
function paths(home) {
  if (!path.isAbsolute(home) || home !== path.normalize(home)) throw new Error("HOME must be absolute and normalized");
  const app = path.join(home, ".bostan", "app");
  const state = path.join(app, "state");
  const instance = path.join(state, "instances", "local");
  return { home, app, state, instance,
    data: path.join(app, "postgres", "data"),
    secrets: path.join(app, "secrets"), logs: path.join(app, "logs"),
    lock: path.join(app, "run.lock"), config: path.join(instance, "config.json") };
}
export function inspectLocalRuntime(repo = REPO, env = process.env) {
  const required = {
    "Bostan checkout": path.join(repo, "package.json"),
    "CLI package": path.join(repo, "cli", "package.json"),
    "Server source": path.join(repo, "server", "src", "index.ts"),
    "Node TypeScript loader": path.join(repo, "server", "node_modules", "tsx", "dist", "loader.mjs"),
    "Built UI": path.join(repo, "ui", "dist", "index.html"),
  };
  const missing = Object.entries(required).filter(([, file]) => !fs.existsSync(file)).map(([key]) => key);
  if (!missing.length) {
    try {
      if (JSON.parse(fs.readFileSync(required["Bostan checkout"], "utf8")).name !== "bostan"
        || JSON.parse(fs.readFileSync(required["CLI package"], "utf8")).name !== "bostan") {
        missing.push("Bostan package identity");
      }
    } catch { missing.push("Bostan package identity"); }
  }
  if (!["darwin", "linux"].includes(process.platform)) missing.push("macOS/Linux platform");
  if (Number(process.versions.node.split(".")[0]) < 24) missing.push("Node.js 24+");
  for (const tool of TOOLS) if (!executable(tool, env)) missing.push(tool);
  return { ready: !missing.length, missing };
}
export function isolatedEnv({ home, port, databaseUrl, jwt, config }, original = process.env) {
  return {
    PATH: original.PATH || "", HOME: home, LANG: original.LANG || "en_US.UTF-8",
    ...(original.TMPDIR ? { TMPDIR: original.TMPDIR } : {}),
    DATABASE_URL: databaseUrl,
    PAPERCLIP_HOME: path.join(home, ".bostan", "app", "state"),
    PAPERCLIP_CONFIG: config,
    PAPERCLIP_INSTANCE_ID: "local",
    PAPERCLIP_AGENT_JWT_SECRET: jwt,
    BETTER_AUTH_SECRET: jwt,
    PAPERCLIP_DEPLOYMENT_MODE: "local_trusted",
    PAPERCLIP_BIND: "loopback",
    HOST: "127.0.0.1",
    PORT: String(port),
    PAPERCLIP_UI_DEV_MIDDLEWARE: "false",
    PAPERCLIP_TELEMETRY_DISABLED: "1",
    DO_NOT_TRACK: "1",
    BOSTAN_ANNOUNCEMENTS_ENABLED: "0",
    // Every agent probe and run must use a fresh private OpenCode daemon.
    // Inheriting the user's background server can collide or cross sessions.
    BOSTAN_OPENCODE_STANDALONE: "1",
    OTEL_SDK_DISABLED: "true",
    PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
  };
}
function writeManagedConfig(p, port) {
  if (entry(p.config, false)) {
    const existing = JSON.parse(fs.readFileSync(p.config, "utf8"));
    if (existing.bostanManagedLocalRuntime !== MARKER) throw new Error("Refusing to overwrite an unmanaged Bostan configuration");
  }
  const contents = {
    $meta: { version: 1, updatedAt: new Date().toISOString(), source: "configure" },
    bostanManagedLocalRuntime: MARKER,
    database: { mode: "postgres", backup: { enabled: false, intervalMinutes: 60, retentionDays: 7,
      dir: path.join(p.instance, "data", "backups") } },
    logging: { mode: "file", logDir: path.join(p.instance, "logs") },
    server: { deploymentMode: "local_trusted", exposure: "private", bind: "loopback",
      host: "127.0.0.1", port, allowedHostnames: [], serveUi: true },
    auth: { baseUrlMode: "auto", disableSignUp: false },
    telemetry: { enabled: false }, updates: { checkEnabled: false },
    storage: { provider: "local_disk", localDisk: { baseDir: path.join(p.instance, "data", "storage") } },
    secrets: { provider: "local_encrypted", strictMode: false,
      localEncrypted: { keyFilePath: path.join(p.instance, "secrets", "master.key") } },
  };
  const temp = p.config + ".tmp-" + process.pid;
  try {
    fs.writeFileSync(temp, JSON.stringify(contents, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    fs.renameSync(temp, p.config);
  } finally { fs.rmSync(temp, { force: true }); }
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}
async function call(binary, args, env = process.env, timeout = 45000) {
  return exec(binary, args, { env, timeout, maxBuffer: 1024 * 1024 });
}
export async function runLocalRuntime(options = {}) {
  const home = options.home || process.env.HOME || os.homedir();
  const port = options.port ?? 3100;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local port");
  const repo = options.repo || REPO;
  const check = inspectLocalRuntime(repo);
  if (!check.ready) throw new Error("Bostan runtime prerequisites missing: " + check.missing.join(", "));
  const p = paths(home);
  if (!entry(home, true)) throw new Error("HOME directory is unavailable");
  for (const dir of [
    path.join(home, ".bostan"), p.app, p.state, path.join(p.state, "instances"),
    p.instance, path.join(p.app, "postgres"), p.secrets, p.logs,
  ]) directory(dir);
  if (inspectRuntimeLock(p.lock).state !== "absent") {
    throw new Error("Bostan runtime lock exists. Verify the database stopped, then use: bostan app recover --local");
  }
  fs.writeFileSync(p.lock, MARKER + ":" + process.pid + "\n", { flag: "wx", mode: 0o600 });
  let pgStarted = false;
  let child = null;
  let interrupted = false;
  const onSignal = () => { interrupted = true; child?.kill("SIGTERM"); };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  try {
    const password = secret(path.join(p.secrets, "db-password"));
    const jwt = secret(path.join(p.secrets, "agent-jwt"));
    const pgPort = await freePort();
    if (!entry(p.data, true)) {
      await call(executable("initdb"), ["-D", p.data, "--username=bostan", "--auth=scram-sha-256",
        "--pwfile=" + path.join(p.secrets, "db-password"), "--no-instructions"]);
    }
    await call(executable("pg_ctl"),
      ["-D", p.data, "-o", "-h 127.0.0.1 -p " + pgPort, "-l", path.join(p.logs, "postgres.log"), "-w", "start"]);
    pgStarted = true;
    const dbEnv = { ...process.env, PGPASSWORD: password };
    const dbArgs = ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "bostan"];
    const found = await call(executable("psql"),
      [...dbArgs, "-d", "postgres", "-tA", "-c", "SELECT 1 FROM pg_database WHERE datname = 'bostan'"], dbEnv);
    if (!found.stdout.trim()) await call(executable("createdb"), [...dbArgs, "bostan"], dbEnv);
    directory(path.join(p.instance, "secrets"));
    writeManagedConfig(p, port);
    const url = "postgres://bostan:" + password + "@127.0.0.1:" + pgPort + "/bostan";
    child = spawn(process.execPath, ["--import", path.join(repo, "server", "node_modules", "tsx", "dist", "loader.mjs"),
      path.join(repo, "server", "src", "index.ts")],
      { cwd: repo, stdio: "inherit", env: isolatedEnv({ home, port, databaseUrl: url, jwt, config: p.config }) });
    let finished = false;
    const exited = new Promise((resolve) => {
      child.once("exit", (code, signal) => { finished = true; resolve(code ?? (signal ? 1 : 0)); });
      child.once("error", () => { finished = true; resolve(1); });
    });
    let healthy = false;
    for (let i = 0; i < 90 && !finished && !interrupted; i++) {
      try {
        const response = await fetch("http://127.0.0.1:" + port + "/api/health",
          { signal: AbortSignal.timeout(1000) });
        if (response.status === 200) { healthy = true; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!healthy && !interrupted) {
      child.kill("SIGTERM");
      await exited;
      throw new Error("Bostan local server did not reach HTTP 200 at /api/health");
    }
    if (healthy) {
      process.stdout.write("Bostan local application: http://127.0.0.1:" + port + "\n");
      process.stdout.write("Press Ctrl+C to shut down this local server and PostgreSQL.\n");
    }
    if (interrupted) child.kill("SIGTERM");
    const code = await exited;
    if (code !== 0 && !interrupted) throw new Error("Bostan server process failed with exit " + code);
    return code;
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    if (child && child.exitCode === null && !child.killed) child.kill("SIGTERM");
    if (pgStarted) {
      try {
        await call(executable("pg_ctl"), ["-D", p.data, "-m", "fast", "-w", "stop"], process.env, 30000);
      } catch (error) {
        process.stderr.write("Bostan PostgreSQL shutdown warning: " + error.message + "\n");
      }
    }
    // Failed pg_ctl start/stop may still leave PostgreSQL running. Confirm
    // the cluster is stopped even if this invocation never reached pgStarted.
    try {
      const result = removeStoppedRuntimeLock({
        lockPath: p.lock, pgData: p.data, pgCtl: executable("pg_ctl"),
        expectedPid: process.pid, mode: "shutdown",
      });
      if (!result.changed) throw new Error("runtime lock unexpectedly disappeared");
    } catch (error) {
      throw new Error("Bostan PostgreSQL shutdown could not be verified. " +
        "The managed lock is retained. Inspect PostgreSQL before running " +
        "bostan app recover --local. " + error.message);
    }
  }
}
