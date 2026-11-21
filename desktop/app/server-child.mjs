import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import diagnostics from "./startup-diagnostics.cjs";

// Only Electron's private utility-process channel may control this backend.
if (!process.parentPort) throw new Error("Bostan desktop backend requires its application host");
process.parentPort.postMessage({ type: "startup-phase", phase: "utility_bootstrap" });

// Internal Node subprocesses use Electron's embedded Node rather than requiring
// a developer Node installation. This is set after utility-process bootstrap.
process.env.ELECTRON_RUN_AS_NODE = "1";
process.env.NODE_OPTIONS = "--conditions=bostan-compiled";
// Electron utilityProcess does not apply --conditions from execArgv (verified
// with its actual Node runtime). Select built workspace exports explicitly.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@bostan/") || context.conditions.includes("bostan-compiled")) return nextResolve(specifier, context);
    return nextResolve(specifier, { ...context, conditions: [...context.conditions, "bostan-compiled"] });
  },
});
let runtime;
let stopping;
let startup;
let startupFailureAckTimer;
function stop() {
  return stopping ??= (async () => {
    // A quit request during migrations must wait for startup to settle before
    // closing the runtime. Exiting early would abandon an owned PostgreSQL.
    try { await startup; }
    catch { return; } // The startup-failure receipt/ack path owns this exit.
    if (runtime) await runtime.shutdown();
    process.exit(0);
  })();
}
process.parentPort.on("message", ({ data }) => {
  if (data?.type === "startup-failure-ack" && startupFailureAckTimer) {
    clearTimeout(startupFailureAckTimer);
    startupFailureAckTimer = null;
    process.exit(1);
  }
  if (data?.type === "shutdown") {
    void stop().catch(() => {
      stopping = null;
      process.parentPort.postMessage({ type: "shutdown-failed" });
    });
  }
});

startup = (async () => {
  const entry = path.join(process.env.BOSTAN_DESKTOP_SERVER_ROOT, "dist/index.js");
  process.parentPort.postMessage({ type: "startup-phase", phase: "importing_server" });
  const { startServer } = await import(pathToFileURL(entry).href);
  process.parentPort.postMessage({ type: "startup-phase", phase: "starting_server" });
  runtime = await startServer();
  process.parentPort.postMessage({ type: "startup-phase", phase: "ready" });
  if (!stopping) process.parentPort.postMessage({ type: "ready", port: runtime.listenPort });
})();
try {
  await startup;
} catch (error) {
  // Raw backend stacks may include secrets, database URLs and host paths.
  const code = diagnostics.startupErrorCode(error);
  const site = diagnostics.startupFailureSite(error, process.env.BOSTAN_DESKTOP_SERVER_ROOT);
  // Utility-process messages are asynchronous. Wait for the application host
  // to receive this bounded receipt before exiting; retain a fixed fallback
  // for a host that has already disappeared.
  startupFailureAckTimer = setTimeout(() => {
    startupFailureAckTimer = null;
    process.exit(1);
  }, 5000);
  process.parentPort.postMessage({ type: "startup-failed", code, site });
}
