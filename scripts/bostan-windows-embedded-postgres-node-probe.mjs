import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROBE_DIRECTORY_PREFIX = "bostan-postgres-node-probe-";

export function isOwnedProbeDirectory(candidate, tempRoot) {
  const relative = path.relative(path.resolve(tempRoot), path.resolve(candidate));
  return relative !== ""
    && !path.isAbsolute(relative)
    && !relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && path.dirname(relative) === "."
    && path.basename(relative).startsWith(PROBE_DIRECTORY_PREFIX);
}

export function shouldRemoveProbeDirectory(probeRoot, tempRoot, cleanupFailed) {
  return !cleanupFailed && Boolean(probeRoot && tempRoot && isOwnedProbeDirectory(probeRoot, tempRoot));
}

export function embeddedPostgresProcessHasExited(instance) {
  const process = instance?.process;
  return Boolean(process && (typeof process.exitCode === "number" || typeof process.signalCode === "string"));
}

export function unhookEmbeddedPostgresExitEvents(exitHook) {
  if (typeof exitHook?.hookedEvents !== "function" || typeof exitHook?.unhookEvent !== "function") return false;
  for (const event of exitHook.hookedEvents()) exitHook.unhookEvent(event);
  return true;
}

async function findAvailablePort() {
  const server = createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Probe port allocation failed");
  const { port } = address;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function runProbe() {
  if (process.platform !== "win32") {
    console.log("BOSTAN_NODE_POSTGRES_PROBE_SKIP unsupported_platform");
    return 0;
  }

  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dbPackagePath = path.join(repositoryRoot, "packages", "db", "package.json");
  const dbRequire = createRequire(dbPackagePath);
  const runtimeModulePath = path.join(repositoryRoot, "packages", "db", "dist", "embedded-postgres-native.js");
  const errorModulePath = path.join(repositoryRoot, "packages", "db", "dist", "embedded-postgres-error.js");
  let instance;
  let logBuffer;
  let postgresDiagnostics;
  let failureIssue = "POSTGRES_START_LOGS_EMPTY";
  let phase = "runtime_prepare";
  let probeRoot;
  let tempRoot;
  let cleanupFailed = false;
  let startupFailed = false;
  let embeddedPostgresExitHook;

  try {
    const [{ prepareEmbeddedPostgresNativeRuntime }] = await Promise.all([
      import(pathToFileURL(runtimeModulePath).href),
    ]);
    postgresDiagnostics = await import(pathToFileURL(errorModulePath).href);
    const embeddedPostgresEntry = dbRequire.resolve("embedded-postgres");
    embeddedPostgresExitHook = createRequire(embeddedPostgresEntry)("async-exit-hook");
    const EmbeddedPostgres = (await import(pathToFileURL(embeddedPostgresEntry).href)).default;
    // Match the packaged QA harness, which creates its disposable profile in
    // os.tmpdir(); RUNNER_TEMP may be a different volume with different ACLs.
    tempRoot = path.resolve(os.tmpdir());
    const tempRootInfo = await fs.lstat(tempRoot);
    if (!tempRootInfo.isDirectory() || tempRootInfo.isSymbolicLink()) {
      throw new Error("Runner temp directory is unsafe");
    }
    probeRoot = await fs.mkdtemp(path.join(tempRoot, `${PROBE_DIRECTORY_PREFIX}${randomUUID()}-`));
    const dataDirectory = path.join(probeRoot, "data");
    const postgresFlags = await prepareEmbeddedPostgresNativeRuntime(dataDirectory);
    const port = await findAvailablePort();
    logBuffer = postgresDiagnostics.createEmbeddedPostgresLogBuffer(40);
    instance = new EmbeddedPostgres({
      databaseDir: dataDirectory,
      user: "paperclip",
      password: "paperclip",
      port,
      persistent: true,
      initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
      postgresFlags,
      onLog: logBuffer.append,
      onError: logBuffer.append,
    });
    phase = "initialize";
    await instance.initialise();
    phase = "start";
    logBuffer.clear();
    await instance.start();
    phase = "stop";
    await instance.stop();
    instance = null;
    console.log("BOSTAN_NODE_POSTGRES_PROBE_PASS");
  } catch (error) {
    startupFailed = true;
    const processExit = typeof error?.message === "string"
      ? /Postgres server exited before readiness \(exitCode=(null|0|[1-9]\d{0,2}), signal=(?:none|SIG[A-Z]+)\)/.exec(error.message)
      : null;
    if (processExit) console.log(`BOSTAN_NODE_POSTGRES_PROBE_PROCESS_EXIT_CODE ${processExit[1]}`);
    try {
      postgresDiagnostics ??= await import(pathToFileURL(errorModulePath).href);
      const { classifyEmbeddedPostgresStartIssue, summarizeEmbeddedPostgresRuntimeDependency, summarizeEmbeddedPostgresStartDiagnostic } = postgresDiagnostics;
      const recentLogs = logBuffer?.getRecentLogs() ?? [];
      failureIssue = classifyEmbeddedPostgresStartIssue(recentLogs);
      const diagnostic = summarizeEmbeddedPostgresStartDiagnostic(recentLogs);
      const processEvidence = recentLogs.flatMap((line) => {
        const spawn = /^POSTGRES_CHILD_SPAWN_ERROR code=([A-Z0-9_]{1,32})$/.exec(line);
        if (spawn) return [{ event: "spawn_error", code: spawn[1] }];
        const closed = /^POSTGRES_CHILD_CLOSED exitCode=(null|0|[1-9]\d{0,2}) signal=(none|SIG[A-Z]{1,12}) stdoutBytes=(0|[1-9]\d{0,8}) stderrBytes=(0|[1-9]\d{0,8})$/.exec(line);
        if (closed) return [{ event: "closed", exitCode: closed[1], signal: closed[2], stdoutBytes: Number(closed[3]), stderrBytes: Number(closed[4]) }];
        return [];
      }).slice(-4);
      const runtimeDependency = summarizeEmbeddedPostgresRuntimeDependency(recentLogs);
      console.log(`BOSTAN_NODE_POSTGRES_PROBE_DIAGNOSTIC ${JSON.stringify({ failureIssue, diagnostic, runtimeDependency, processEvidence })}`);
    } catch {
      failureIssue = "POSTGRES_START_UNCLASSIFIED";
    }
    console.log(`BOSTAN_NODE_POSTGRES_PROBE_FAIL ${phase} ${failureIssue}`);
  } finally {
    // embedded-postgres.stop() listens for a future `exit` event. When startup
    // rejects from the child's `close` event, that exit has already happened;
    // awaiting stop then leaves an unresolvable promise and Node can exit 0
    // before this probe reports failure. The owned child is already gone.
    if (embeddedPostgresProcessHasExited(instance)) instance = null;
    if (instance) {
      try { await instance.stop(); }
      catch { cleanupFailed = true; }
    }
    if (shouldRemoveProbeDirectory(probeRoot, tempRoot, cleanupFailed)) {
      try {
        const [rootInfo, realTempRoot, realParent] = await Promise.all([
          fs.lstat(probeRoot),
          fs.realpath(tempRoot),
          fs.realpath(path.dirname(probeRoot)),
        ]);
        if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || realTempRoot !== realParent) {
          cleanupFailed = true;
        } else {
          await fs.rm(probeRoot, { recursive: true, force: false });
        }
      } catch {
        cleanupFailed = true;
      }
    } else if (probeRoot) {
      cleanupFailed = true;
    }
    // embedded-postgres' async-exit-hook forces process.exit(0) after beforeExit,
    // which masks the probe's nonzero exitCode. Once this probe's owned child
    // is confirmed stopped, its own cleanup is complete and the hook is no
    // longer needed in this short-lived, single-cluster process.
    if (!cleanupFailed && !instance?.process) {
      try {
        if (embeddedPostgresExitHook && !unhookEmbeddedPostgresExitEvents(embeddedPostgresExitHook)) cleanupFailed = true;
      } catch {
        cleanupFailed = true;
      }
    }
  }

  if (cleanupFailed) {
    console.log("BOSTAN_NODE_POSTGRES_PROBE_CLEANUP_FAIL");
    return 1;
  }
  if (startupFailed) console.log("BOSTAN_NODE_POSTGRES_PROBE_CLEANUP_PASS");
  return startupFailed ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const exitCode = await runProbe();
  console.log(`BOSTAN_NODE_POSTGRES_PROBE_PROCESS_EXIT ${exitCode}`);
  process.exitCode = exitCode;
}
