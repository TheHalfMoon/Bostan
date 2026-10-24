import { randomBytes } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectRuntimeLock, removeStoppedRuntimeLock } from "./bostan-runtime-recovery.mjs";
import { enforceWindowsQaPrivateAcl } from "./bostan-windows-acl.mjs";
import { startPrivateStopControl } from "./bostan-local-stop.mjs";

const exec = promisify(execFile);
export const REPO = fileURLToPath(new URL("../", import.meta.url));
const MARKER = "bostan-managed-source-runtime-v1";
const TOOLS = ["initdb", "pg_ctl", "psql", "createdb"];

// Windows initdb otherwise inherits the machine's legacy ANSI code page
// (for example WIN1252) and fails on ordinary Bostan Unicode skill markdown.
// A deterministic UTF-8/C cluster is required for every new local install.
export const POSTGRES_LOCAL_INITDB_ENCODING_ARGS = Object.freeze([
  "--encoding=UTF8", "--locale=C",
]);

export function assertUtf8PostgresEncoding(value, databaseName) {
  if (typeof value !== "string" || value.trim() !== "UTF8") {
    // No implicit re-initialization or deletion. An old cluster might
    // contain valuable data and requires a separately planned migration.
    throw new Error("Bostan PostgreSQL " + databaseName +
      " is not UTF8. Existing cluster retained; backup and migrate explicitly before local runtime use.");
  }
}


export function executable(name, env = process.env) {
  // Windows PostgreSQL commands are .exe files, whereas macOS/Linux tools
  // are usually extensionless (often Homebrew symlinks). Never launch .cmd,
  // .bat or arbitrary PATHEXT handlers when resolving a database executable.
  const windows = process.platform === "win32";
  const filenames = windows && !/\.exe$/i.test(name) ? [name + ".exe"] : [name];
  for (const rawDir of (env.PATH || "").split(path.delimiter)) {
    const dir = windows ? rawDir.replace(/^"|"$/g, "") : rawDir;
    if (!path.isAbsolute(dir)) continue;
    for (const filename of filenames) {
      const candidate = path.join(dir, filename);
      try {
        const entry = fs.statSync(candidate);
        if (entry.isFile()) return candidate;
      } catch {}
    }
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
    // Windows' Node fs.stat mode does not model NTFS ACLs: a mode:0600 file
    // still reports 0666. This branch is Windows *disposable QA only*, not
    // a production ACL qualification. All Windows QA paths must be temp-owned.
    if (process.platform !== "win32" && (fs.statSync(p).mode & 0o077)) {
      throw new Error("Insecure Bostan secret permissions");
    }
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
/**
 * No Windows installation or real-profile operation is supported yet.
 * Temporary test runs are opt-in and must never target an existing user HOME.
 * The HOME path must already be a real directory inside this user's temp root.
 */
export function windowsDisposableQaHome(home, env = process.env) {
  if (process.platform !== "win32" || env.BOSTAN_WINDOWS_TEMP_QA !== "1"
    || typeof home !== "string" || !path.isAbsolute(home)
    || home !== path.normalize(home)) return false;
  try {
    const root = fs.realpathSync(os.tmpdir()).toLowerCase();
    const resolved = fs.realpathSync(home).toLowerCase();
    return resolved.startsWith(root + path.sep)
      && resolved !== root
      && fs.lstatSync(home).isDirectory()
      && !fs.lstatSync(home).isSymbolicLink();
  } catch { return false; }
}

export function inspectLocalRuntime(repo = REPO, env = process.env, home = env.HOME || os.homedir()) {
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
  if (!["darwin", "linux"].includes(process.platform)
    && !windowsDisposableQaHome(home, env)) {
    missing.push("Windows requires explicit isolated TEMP QA (not a supported installer)");
  }
  if (Number(process.versions.node.split(".")[0]) < 24) missing.push("Node.js 24+");
  for (const tool of TOOLS) if (!executable(tool, env)) missing.push(tool);
  return { ready: !missing.length, missing };
}
/**
 * Windows TEMP-only QA captures backend output in a private per-run file.
 * Never copy this log to a public issue or release: server logs may contain
 * confidential requests, model prompts or debugging data.
 */
export function serverStartupProbeLimit({ windowsQa }) {
  // macOS/Linux may also require a cold-source TypeScript import plus first
  // database migrations on a busy, low-memory developer machine. 90 probes
  // killed a healthy first boot before it could bind localhost. Keep an
  // explicit finite cap; never broaden network binding or skip health/ACL.
  // Disposable Windows QA retains its existing larger cold-start allowance.
  return windowsQa ? 360 : 180;
}

export function serverStartupLogPath(logDirectory, pid, timestamp = Date.now()) {
  if (!path.isAbsolute(logDirectory) || !Number.isSafeInteger(pid) || pid < 1
    || !Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error("Invalid Bostan server startup log path");
  }
  return path.join(logDirectory, `server-startup-${pid}-${timestamp}.log`);
}

export function isolatedEnv({ home, port, databaseUrl, jwt, config }, original = process.env) {
  return {
    PATH: original.PATH || "", HOME: home, LANG: original.LANG || "en_US.UTF-8",
    ...(original.TMPDIR ? { TMPDIR: original.TMPDIR } : {}),
    ...(process.platform === "win32" ? {
      SystemRoot: original.SystemRoot || path.join(path.parse(home).root, "Windows"),
      WINDIR: original.WINDIR || original.SystemRoot || path.join(path.parse(home).root, "Windows"),
      USERPROFILE: home,
      // The launcher already verified explicit Windows TEMP-only QA admission.
      // Propagate that scoped marker to the private backend child so local
      // startup diagnostics can distinguish this from production operation.
      BOSTAN_WINDOWS_TEMP_QA: "1",
      TEMP: path.join(home, ".bostan", "app", "tmp"),
      TMP: path.join(home, ".bostan", "app", "tmp"),
      APPDATA: path.join(home, ".bostan", "app", "roaming"),
      LOCALAPPDATA: path.join(home, ".bostan", "app", "local-appdata"),
    } : {}),
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
  const check = inspectLocalRuntime(repo, process.env, home);
  if (!check.ready) throw new Error("Bostan runtime prerequisites missing: " + check.missing.join(", "));
  const p = paths(home);
  if (!entry(home, true)) throw new Error("HOME directory is unavailable");
  const privateRoot = path.join(home, ".bostan");
  const newRoot = !entry(privateRoot, true);
  directory(privateRoot);
  if (process.platform === "win32") {
    // Fail closed before creating any application secrets or private data.
    // Fresh roots get a protected DACL; restarts VERIFY without rewriting
    // existing permissions or silently widening earlier ACLs.
    enforceWindowsQaPrivateAcl(home, { fresh: newRoot });
  }
  for (const dir of [
    p.app, p.state, path.join(p.state, "instances"),
    p.instance, path.join(p.app, "postgres"), p.secrets, p.logs,
    ...(process.platform === "win32" ? [
      path.join(p.app, "tmp"), path.join(p.app, "roaming"),
      path.join(p.app, "local-appdata"),
    ] : []),
  ]) directory(dir);
  if (inspectRuntimeLock(p.lock).state !== "absent") {
    throw new Error("Bostan runtime lock exists. Verify the database stopped, then use: bostan app recover --local");
  }
  fs.writeFileSync(p.lock, MARKER + ":" + process.pid + "\n", { flag: "wx", mode: 0o600 });
  let pgStarted = false;
  let child = null;
  let startupLog = null;
  let startupLogPath = null;
  let stopControl = null;
  let interrupted = false;
  const windowsQa = process.platform === "win32" && windowsDisposableQaHome(home);
  const onSignal = () => {
    interrupted = true;
    if (windowsQa && child?.connected) {
      child.send({ type: "bostan:managed:stop" }, () => {});
    } else if (!windowsQa) {
      child?.kill("SIGTERM");
    }
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  try {
    const password = secret(path.join(p.secrets, "db-password"));
    const jwt = secret(path.join(p.secrets, "agent-jwt"));
    const pgPort = await freePort();
    if (!entry(p.data, true)) {
      await call(executable("initdb"), ["-D", p.data, "--username=bostan", "--auth=scram-sha-256",
        ...POSTGRES_LOCAL_INITDB_ENCODING_ARGS,
        "--pwfile=" + path.join(p.secrets, "db-password"), "--no-instructions"]);
    }
    await call(executable("pg_ctl"),
      ["-D", p.data, "-o", "-h 127.0.0.1 -p " + pgPort, "-l", path.join(p.logs, "postgres.log"), "-w", "start"]);
    pgStarted = true;
    const dbEnv = { ...process.env, PGPASSWORD: password };
    const dbArgs = ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "bostan"];
    // Verify BEFORE launching the server or applying any migrations. On
    // Windows older Bostan TEMP clusters may have inherited WIN1252 from
    // the OS: the database is healthy but cannot store Unicode agent skills.
    const postgresEncoding = await call(executable("psql"), [
      ...dbArgs, "-d", "postgres", "-tA", "-c",
      "SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname='postgres'",
    ], dbEnv);
    assertUtf8PostgresEncoding(postgresEncoding.stdout, "system database");
    const found = await call(executable("psql"),
      [...dbArgs, "-d", "postgres", "-tA", "-c", "SELECT 1 FROM pg_database WHERE datname = 'bostan'"], dbEnv);
    if (!found.stdout.trim()) await call(executable("createdb"), [...dbArgs, "bostan"], dbEnv);
    const appEncoding = await call(executable("psql"), [
      ...dbArgs, "-d", "postgres", "-tA", "-c",
      "SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname='bostan'",
    ], dbEnv);
    assertUtf8PostgresEncoding(appEncoding.stdout, "application database");
    directory(path.join(p.instance, "secrets"));
    writeManagedConfig(p, port);
    const url = "postgres://bostan:" + password + "@127.0.0.1:" + pgPort + "/bostan";
    if (windowsQa) {
      stopControl = await startPrivateStopControl({ home, onStop: onSignal });
      startupLogPath = serverStartupLogPath(p.logs, process.pid);
      startupLog = fs.createWriteStream(startupLogPath, { flags: "wx", mode: 0o600 });
    }
    child = spawn(process.execPath, ["--import", pathToFileURL(path.join(repo, "server", "node_modules", "tsx", "dist", "loader.mjs")).href,
      windowsQa
        ? path.join(repo, "scripts", "bostan-managed-server-child.mjs")
        : path.join(repo, "server", "src", "index.ts")],
      { cwd: repo, stdio: windowsQa ? ["ignore", "pipe", "pipe", "ipc"] : "inherit",
        env: isolatedEnv({ home, port, databaseUrl: url, jwt, config: p.config }) });
    if (windowsQa) {
      // Consuming both streams prevents a stalled backend process from
      // blocking on a full pipe. Keep logs on the disposable local profile.
      child.stdout.pipe(startupLog, { end: false });
      child.stderr.pipe(startupLog, { end: false });
      process.stdout.write("Bostan Windows TEMP-only server log: " + startupLogPath + "\n");
    }
    let finished = false;
    const exited = new Promise((resolve) => {
      child.once("exit", (code, signal) => { finished = true; resolve(code ?? (signal ? 1 : 0)); });
      child.once("error", () => { finished = true; resolve(1); });
    });
    let healthy = false;
    for (let i = 0; i < serverStartupProbeLimit({ windowsQa }) && !finished && !interrupted; i++) {
      try {
        const response = await fetch("http://127.0.0.1:" + port + "/api/health",
          { signal: AbortSignal.timeout(1000) });
        if (response.status === 200) { healthy = true; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!healthy && !interrupted) {
      if (!finished) child.kill("SIGTERM");
      const exitCode = await exited;
      throw new Error("Bostan local server did not reach HTTP 200 at /api/health" +
        (startupLogPath ? "; inspect private TEMP-only startup log: " + startupLogPath : "") +
        " (server exit " + exitCode + ")");
    }
    if (healthy) {
      process.stdout.write("Bostan local application: http://127.0.0.1:" + port + "\n");
      process.stdout.write("Press Ctrl+C to shut down this local server and PostgreSQL.\n");
    }
    if (interrupted) onSignal();
    const code = await exited;
    if (code !== 0 && !interrupted) throw new Error("Bostan server process failed with exit " + code);
    return code;
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    if (child && child.exitCode === null && !child.killed) {
      // Error paths may require an ungraceful last-resort process kill.
      // Normal Windows TEMP QA app-stop uses the child IPC programmatic
      // server.shutdown() and awaits exit before reaching this finally.
      child.kill("SIGTERM");
    }
    let stopControlError = null;
    if (stopControl) {
      try {
        await stopControl.close();
      } catch (error) {
        stopControlError = error;
        process.stderr.write("Bostan private stop-control cleanup warning; PostgreSQL shutdown will still run.\n");
      }
    }
    if (startupLog) {
      // Child pipes were connected with end:false; explicit close is required
      // after the child terminates so the test log is not left open.
      child?.stdout?.unpipe(startupLog);
      child?.stderr?.unpipe(startupLog);
      await new Promise((resolve) => {
        startupLog.once("close", resolve);
        startupLog.once("error", resolve);
        startupLog.end();
      });
    }
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
    if (stopControlError) {
      throw new Error("Bostan PostgreSQL stopped and managed runtime lock was cleared, " +
        "but stop control metadata could not be safely removed. " +
        "Inspect the disposable profile before restarting.");
    }
  }
}
