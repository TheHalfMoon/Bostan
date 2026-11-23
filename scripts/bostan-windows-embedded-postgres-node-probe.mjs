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
  let failureIssue = "POSTGRES_START_LOGS_EMPTY";
  let phase = "runtime_prepare";
  let probeRoot;
  let tempRoot;
  let cleanupFailed = false;
  let startupFailed = false;

  try {
    const [{ prepareEmbeddedPostgresNativeRuntime }] = await Promise.all([
      import(pathToFileURL(runtimeModulePath).href),
    ]);
    const embeddedPostgresEntry = dbRequire.resolve("embedded-postgres");
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
    const recentLogs = [];
    logBuffer = {
      append(message) {
        const text = typeof message === "string"
          ? message
          : message instanceof Error
            ? message.message
            : String(message ?? "");
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) recentLogs.push(line.trim());
        }
        if (recentLogs.length > 40) recentLogs.splice(0, recentLogs.length - 40);
      },
      getRecentLogs() { return [...recentLogs]; },
    };
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
      const { classifyEmbeddedPostgresStartIssue, summarizeEmbeddedPostgresStartDiagnostic } = await import(pathToFileURL(errorModulePath).href);
      const recentLogs = logBuffer?.getRecentLogs() ?? [];
      failureIssue = classifyEmbeddedPostgresStartIssue(recentLogs);
      const diagnostic = summarizeEmbeddedPostgresStartDiagnostic(recentLogs);
      if (diagnostic.sharedMemoryFailureKind) {
        console.log(`BOSTAN_NODE_POSTGRES_PROBE_DETAIL ${JSON.stringify(diagnostic)}`);
      }
    } catch {
      failureIssue = "POSTGRES_START_UNCLASSIFIED";
    }
    console.log(`BOSTAN_NODE_POSTGRES_PROBE_FAIL ${phase} ${failureIssue}`);
  } finally {
    if (instance) {
      try { await instance.stop(); }
      catch { cleanupFailed = true; }
    }
    if (probeRoot && tempRoot && isOwnedProbeDirectory(probeRoot, tempRoot)) {
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
