import { spawn } from "node:child_process";

export const MACOS_APP_COPY_TIMEOUT_MS = 15 * 60_000;
export const MACOS_APP_COPY_HEARTBEAT_MS = 30_000;
const MAX_PENDING_OUTPUT_CHARS = 8192;

function receipt(elapsedMs, entriesCopied, previousEntries) {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const progress = entriesCopied > previousEntries ? "advanced" : "stalled";
  return `BOSTAN_MACOS_INSTALLER_COPY_WAIT elapsedSeconds=${elapsedSeconds} entriesCopied=${entriesCopied} progress=${progress}`;
}

/** Copies only the owned mounted app into the isolated QA Applications directory. */
export function copyMacInstalledApp(source, destination, {
  command = "/usr/bin/ditto",
  spawnChild = spawn,
  timeoutMs = MACOS_APP_COPY_TIMEOUT_MS,
  heartbeatMs = MACOS_APP_COPY_HEARTBEAT_MS,
  onProgress = line => console.log(line),
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MACOS_APP_COPY_TIMEOUT_MS) {
    throw new Error("macos_app_copy_invalid_timeout");
  }
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 1 || heartbeatMs > timeoutMs) {
    throw new Error("macos_app_copy_invalid_heartbeat");
  }

  const startedAt = Date.now();
  let entriesCopied = 0;
  let previousEntries = 0;
  let pending = "";
  let timedOut = false;
  let settled = false;
  let terminateTimer;
  let heartbeatTimer;
  let timeoutTimer;
  let child;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearInterval(heartbeatTimer);
      clearTimeout(timeoutTimer);
      clearTimeout(terminateTimer);
    };
    const finish = error => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve({ elapsedMs: Date.now() - startedAt, entriesCopied });
    };
    const onOutput = chunk => {
      pending += chunk.toString("utf8");
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      entriesCopied += lines.filter(line => line.length > 0).length;
      if (pending.length > MAX_PENDING_OUTPUT_CHARS) {
        pending = pending.slice(-MAX_PENDING_OUTPUT_CHARS);
        entriesCopied++;
      }
    };
    try {
      child = spawnChild(command, ["-V", source, destination], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch {
      finish(new Error("macos_app_copy_spawn_failed"));
      return;
    }
    child.stdout?.on("data", onOutput);
    child.stderr?.on("data", onOutput);
    child.once("error", () => finish(new Error(timedOut ? "macos_app_copy_timeout" : "macos_app_copy_process_error")));
    child.once("close", code => {
      if (timedOut) finish(new Error("macos_app_copy_timeout"));
      else if (code !== 0) finish(new Error("macos_app_copy_failed"));
      else finish();
    });

    heartbeatTimer = setInterval(() => {
      try { onProgress(receipt(Date.now() - startedAt, entriesCopied, previousEntries)); } catch {}
      previousEntries = entriesCopied;
    }, heartbeatMs);
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      terminateTimer = setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 5000);
    }, timeoutMs);
  });
}
