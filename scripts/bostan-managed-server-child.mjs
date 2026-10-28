import { fileURLToPath } from "node:url";
import path from "node:path";

/** Keep Windows parent-requested shutdown inside the child Node event loop.
 * Windows process.kill(SIGTERM) is not a portable substitute for a signal
 * handler: on Windows it may terminate the process without service cleanup.
 */
// The parent may disconnect while startup or shutdown is indefinitely pending.
// A bounded stop deadline prevents a detached backend from keeping DB sockets
// and an HTTP listener alive indefinitely. Test-only injection is internal.
export function superviseManagedServer(startServer, ipc = process, { stopTimeoutMs = 30_000 } = {}) {
  const deadlineMs = Number.isSafeInteger(stopTimeoutMs) && stopTimeoutMs >= 1 &&
    stopTimeoutMs <= 60_000 ? stopTimeoutMs : 30_000;
  let pending = false;
  let closing = false;
  let ready = null;
  let resolveReady;
  let stopTimer = null;
  let reported = false;
  const started = new Promise((resolve) => { resolveReady = resolve; });
  const onMessage = (value) => {
    if (value?.type !== "bostan:managed:stop") return;
    requestStop();
  };
  function requestStop() {
    if (reported) return;
    pending = true;
    // Start the clock at the first stop request, not after startup settles:
    // startup itself can hang after the parent disappears.
    if (stopTimer === null) {
      stopTimer = setTimeout(() => reportAndExit("bostan:managed:stop-failed", 1), deadlineMs);
      stopTimer.unref?.();
    }
    if (!closing) void orderlyStop();
  }
  function reportAndExit(type, code) {
    if (reported) return;
    reported = true;
    if (stopTimer !== null) clearTimeout(stopTimer);
    // An orphaned Windows child has a disconnected IPC pipe. Reporting is
    // best effort; failure to send an acknowledgement must never leave the
    // completed server alive with an unowned database connection.
    try {
      if (ipc.connected !== false) ipc.send?.({ type });
    } catch {}
    ipc.exit?.(code);
  }
  async function orderlyStop() {
    if (!pending || closing) return;
    closing = true;
    try {
      const instance = await started;
      if (!instance) return; // startup failed and the process will exit nonzero
      await instance.shutdown("SIGTERM");
      reportAndExit("bostan:managed:stopped", 0);
    } catch (error) {
      reportAndExit("bostan:managed:stop-failed", 1);
    }
  }
  // If the launcher dies, the child must not continue to serve against an
  // orphaned PostgreSQL cluster. Shutdown remains best effort, and recovery
  // still requires the separately verified stopped-database lock protocol.
  ipc.on("message", onMessage);
  ipc.on("disconnect", requestStop);
  ready = Promise.resolve().then(startServer);
  ready.then((instance) => {
    resolveReady(instance);
    if (pending) void orderlyStop();
  }, () => resolveReady(null));
  return ready.finally(() => {
    // Keep listener until a stop arrives; the parent owns the IPC channel.
  });
}

async function main() {
  // The imported Bostan server is not the main module, so its ordinary
  // process-signal launch branch stays inactive; we own graceful stop.
  // This diagnostic is local to explicitly disposable Windows QA and does
  // not print model prompts, credentials or private runtime configuration.
  const tracing = process.platform === "win32" && process.env.BOSTAN_WINDOWS_TEMP_QA === "1";
  const startedAt = performance.now();
  if (tracing) process.stderr.write("Bostan Windows QA: beginning server module import.\n");
  const { startServer } = await import("../server/src/index.ts");
  if (tracing) process.stderr.write("Bostan Windows QA: module import complete after " +
    Math.round((performance.now() - startedAt) / 1000) + " seconds; beginning startup.\n");
  await superviseManagedServer(async () => {
    const result = await startServer();
    if (tracing) process.stderr.write("Bostan Windows QA: service startup complete after " +
      Math.round((performance.now() - startedAt) / 1000) + " seconds.\n");
    return result;
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // A backend exception can contain DATABASE_URL credentials, OAuth tokens,
    // customer data or full filesystem paths. Windows QA logs must not emit it.
    const name = error instanceof Error ? error.name : "";
    const kind = ["Error", "TypeError", "SyntaxError", "ReferenceError", "RangeError"]
      .includes(name) ? name : "other";
    // With an IPC listener (and potentially opened DB sockets), exitCode=1
    // does NOT guarantee termination. On failed startup, the launcher must
    // observe a nonzero child exit and retain the database recovery lock.
    process.stderr.write("Bostan managed Windows backend startup failed (" +
      kind + "); private details suppressed.\n", () => process.exit(1));
  });
}
