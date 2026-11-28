import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const MAX_MODEL_PULL_OUTPUT_BYTES = 1024 * 1024;
const MAX_TAIL_BYTES = 32 * 1024;

export function classifyModelPullDiagnostic(text) {
  if (/(?:no space left|not enough space|disk full|insufficient disk)/i.test(text)) return "disk_space";
  if (/(?:unauthorized|forbidden|terms? of service|license acceptance|\bHTTP\s*(?:401|403)\b)/i.test(text)) return "authorization";
  if (/(?:manifest.*(?:unknown|not found)|model.*(?:unknown|not found|does not exist))/i.test(text)) return "model_unavailable";
  if (/(?:out of memory|allocation failed|resource exhausted|not enough memory)/i.test(text)) return "resource";
  if (/(?:access denied|permission denied)/i.test(text)) return "access_denied";
  if (/(?:resolve|dns|proxy|network|tls|certificate|timed out|deadline exceeded|unexpected eof|\beof\b|context canceled|connection (?:refused|reset|closed)|failed to connect|could not connect)/i.test(text)) return "network";
  return "other";
}

async function readTail(filePath, maxBytes = MAX_TAIL_BYTES) {
  let file;
  try {
    file = await open(filePath, "r");
    const info = await file.stat();
    const length = Math.min(info.size, maxBytes);
    const buffer = Buffer.alloc(length);
    if (length) await file.read(buffer, 0, length, info.size - length);
    return buffer.toString("utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  } finally {
    await file?.close();
  }
}

const childClosePromises = new WeakMap();
const childExitPromises = new WeakMap();
function waitForClose(child) {
  let promise = childClosePromises.get(child);
  if (!promise) {
    promise = new Promise((resolve) => child.once("close", (code, signal) => resolve({ code, signal })));
    childClosePromises.set(child, promise);
  }
  return promise;
}

function waitForExit(child) {
  let promise = childExitPromises.get(child);
  if (!promise) {
    promise = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
    childExitPromises.set(child, promise);
  }
  return promise;
}

async function terminateOwnedModelPull(child) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  if (!child.pid) return false;
  // ChildProcess.kill uses its OS process handle, avoiding PID reuse and
  // ensuring this supervisor never targets a process by a stale numeric PID.
  return child.kill();
}

export async function runBoundedModelPull({
  executable,
  args,
  stdoutPath,
  stderrPath,
  maxOutputBytes = MAX_MODEL_PULL_OUTPUT_BYTES,
  heartbeatMs = 60_000,
  terminationTimeoutMs = 5_000,
  spawnProcess = spawn,
  onHeartbeat = () => {},
}) {
  const stdoutFile = await open(stdoutPath, "wx");
  let stderrFile;
  try {
    stderrFile = await open(stderrPath, "wx");
  } catch (error) {
    await stdoutFile.close();
    throw error;
  }

  let child;
  let outputBytes = 0;
  let outputLimitExceeded = false;
  let ioFailed = false;
  let launchError = false;
  let killPromise;
  let terminationAccepted = true;
  let resolveKillRequested;
  const killRequested = new Promise((resolve) => { resolveKillRequested = resolve; });
  let readFailure;
  let writeQueue = Promise.resolve();
  const startedAt = Date.now();
  let lastHeartbeat = 0;
  let lastOutputBytes = 0;
  const requestKill = () => {
    if (!killPromise) {
      resolveKillRequested();
      killPromise = terminateOwnedModelPull(child).then((confirmed) => {
        terminationAccepted = terminationAccepted && confirmed;
        return confirmed;
      });
    }
    return killPromise;
  };

  const closeUnderSupervisor = async (closed, exited, runningChild) => {
    const first = await Promise.race([
      closed.then((value) => ({ type: "closed", value })),
      killRequested.then(() => ({ type: "kill_requested" })),
      exited.then((value) => ({ type: "exited", value })),
    ]);
    if (first.type === "closed") return { ...first.value, timedOut: false };
    if (first.type === "kill_requested") await killPromise;
    const final = await Promise.race([
      closed.then((value) => ({ type: "closed", value })),
      new Promise((resolve) => setTimeout(() => resolve({ type: "timeout" }), terminationTimeoutMs)),
    ]);
    if (final.type === "closed") return { ...final.value, timedOut: false };
    terminationAccepted = false;
    runningChild.stdout?.destroy();
    runningChild.stderr?.destroy();
    runningChild.stdout?.unref?.();
    runningChild.stderr?.unref?.();
    runningChild.unref();
    return { code: runningChild.exitCode, signal: runningChild.signalCode, timedOut: true };
  };

  const appendBounded = (outputFile, chunk) => {
    const operation = writeQueue.then(async () => {
      if (ioFailed) return { exceeded: false, ioError: true };
      const remaining = Math.max(0, maxOutputBytes - outputBytes);
      const written = Math.min(remaining, chunk.length);
      let bytesWritten = 0;
      if (written > 0) {
        const result = await outputFile.write(chunk.subarray(0, written));
        bytesWritten = result.bytesWritten;
        outputBytes += bytesWritten;
        if (bytesWritten !== written) ioFailed = true;
      }
      const exceeded = written < chunk.length || (remaining === 0 && chunk.length > 0);
      if (exceeded) outputLimitExceeded = true;
      return { exceeded: exceeded || bytesWritten !== written, ioError: bytesWritten !== written };
    });
    writeQueue = operation.catch(() => { ioFailed = true; });
    return operation;
  };

  const drain = async (source, outputFile) => {
    for await (const chunk of source) {
      const result = await appendBounded(outputFile, chunk);
      if (result.ioError) ioFailed = true;
      if (result.exceeded || result.ioError) await requestKill();
    }
  };

  let heartbeat;
  try {
    child = spawnProcess(executable, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.once("error", () => { launchError = true; });
    const closed = waitForClose(child);
    const exited = waitForExit(child);
    const trackDrain = (promise) => promise.catch(async (error) => {
      readFailure ??= error;
      ioFailed = true;
      await requestKill();
      return undefined;
    });
    const stdoutDrain = trackDrain(drain(child.stdout, stdoutFile));
    const stderrDrain = trackDrain(drain(child.stderr, stderrFile));
    heartbeat = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsedSeconds < lastHeartbeat + 60) return;
      lastHeartbeat = elapsedSeconds - (elapsedSeconds % 60);
      const progress = outputBytes > lastOutputBytes ? "advanced" : "stalled";
      lastOutputBytes = outputBytes;
      try { onHeartbeat({ elapsedSeconds: lastHeartbeat, outputProgress: progress }); } catch { /* diagnostics must not interrupt child supervision */ }
    }, heartbeatMs);
    heartbeat.unref?.();
    const closeResult = await closeUnderSupervisor(closed, exited, child);
    await Promise.allSettled([stdoutDrain, stderrDrain]);
    await killPromise;
    await stdoutFile.close();
    await stderrFile.close();
    const [stdoutText, stderrText] = await Promise.all([readTail(stdoutPath), readTail(stderrPath)]);
    const exitCode = closeResult?.code ?? null;
    const failureClass = outputLimitExceeded
      ? "output_limit"
      : ioFailed
        ? "io_error"
        : launchError
          ? "process_launch"
        : exitCode === null
          ? "process_state"
          : exitCode === 0
            ? "none"
            : "process_exit";
    return {
      exitCode,
      signal: closeResult?.signal ?? null,
      outputBytes,
      outputLimitExceeded,
      failureClass,
      diagnostic: outputLimitExceeded ? "output_limit" : classifyModelPullDiagnostic(stdoutText + "\n" + stderrText),
      childClosed: !closeResult.timedOut,
      terminationAccepted,
      ioFailed: ioFailed || Boolean(readFailure),
    };
  } catch (error) {
    let childCloseConfirmed = !child;
    if (child) {
      try {
        if (child.exitCode === null && child.signalCode === null) await requestKill();
        childCloseConfirmed = await Promise.race([
          waitForClose(child).then(() => true),
          new Promise((resolve) => setTimeout(() => resolve(false), terminationTimeoutMs)),
        ]);
        if (!childCloseConfirmed) {
          child.stdout?.destroy();
          child.stderr?.destroy();
          child.stdout?.unref?.();
          child.stderr?.unref?.();
          child.unref();
        }
      } catch { childCloseConfirmed = false; }
    }
    try { await stdoutFile.close(); } catch { /* already closed */ }
    try { await stderrFile.close(); } catch { /* already closed */ }
    const failure = new Error("model_pull_supervisor_failed");
    failure.childClosed = childCloseConfirmed;
    throw failure;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key.startsWith("--") || index + 1 >= argv.length || values.has(key)) throw new Error("invalid_arguments");
    values.set(key, argv[index + 1]);
  }
  for (const key of ["--executable", "--model", "--stdout", "--stderr"]) {
    if (!values.get(key)) throw new Error("invalid_arguments");
  }
  if (values.get("--model") !== "qwen2.5-coder:1.5b") throw new Error("model_not_authorized");
  return {
    executable: values.get("--executable"),
    args: ["pull", values.get("--model")],
    stdoutPath: values.get("--stdout"),
    stderrPath: values.get("--stderr"),
  };
}

function emitResult(result) {
  const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : "unavailable";
  console.log("BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=" + exitCode
    + " diagnostic=" + result.diagnostic
    + " failureClass=" + result.failureClass
    + " outputBytes=" + result.outputBytes
    + " childClose=" + (result.childClosed === false ? "unconfirmed" : "closed"));
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch {
    emitResult({ exitCode: null, diagnostic: "other", failureClass: "process_launch", outputBytes: 0, childClosed: true });
    process.exitCode = 2;
    return;
  }
  try {
    const result = await runBoundedModelPull({
      ...options,
      onHeartbeat: (receipt) => console.log("BOSTAN_NATIVE_MODEL_PULL_WAIT elapsedSeconds=" + receipt.elapsedSeconds
        + " outputProgress=" + receipt.outputProgress),
    });
    emitResult(result);
    if (result.exitCode !== 0 || result.failureClass !== "none" || !result.childClosed) process.exitCode = 1;
  } catch (error) {
    emitResult({ exitCode: null, diagnostic: "other", failureClass: "io_error", outputBytes: 0, childClosed: error.childClosed === true });
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
