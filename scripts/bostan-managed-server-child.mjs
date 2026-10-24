import { fileURLToPath } from "node:url";
import path from "node:path";

/** Keep Windows parent-requested shutdown inside the child Node event loop.
 * Windows process.kill(SIGTERM) is not a portable substitute for a signal
 * handler: on Windows it may terminate the process without service cleanup.
 */
export function superviseManagedServer(startServer, ipc = process) {
  let pending = false;
  let closing = false;
  let ready = null;
  let resolveReady;
  const started = new Promise((resolve) => { resolveReady = resolve; });
  const onMessage = (value) => {
    if (value?.type !== "bostan:managed:stop") return;
    pending = true;
    if (!closing) void orderlyStop();
  };
  async function orderlyStop() {
    if (!pending || closing) return;
    closing = true;
    try {
      const instance = await started;
      if (!instance) return; // startup failed and the process will exit nonzero
      await instance.shutdown("SIGTERM");
      ipc.send?.({ type: "bostan:managed:stopped" });
      ipc.exit?.(0);
    } catch (error) {
      ipc.send?.({ type: "bostan:managed:stop-failed" });
      ipc.exit?.(1);
    }
  }
  ipc.on("message", onMessage);
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
  const { startServer } = await import("../server/src/index.ts");
  await superviseManagedServer(startServer);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write("Bostan managed Windows backend startup failed: " +
      (error?.message || "unknown error") + "\n");
    process.exitCode = 1;
  });
}
