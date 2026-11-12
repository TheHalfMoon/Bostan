import diagnostics from "../app/startup-diagnostics.cjs";

// Forward only complete, fixed receipts. Never forward arbitrary Electron or backend output.
export function observeInstalledAppStartup(application, onLine) {
  const child = application.process();
  const listeners = [];
  for (const stream of [child?.stdout, child?.stderr]) {
    if (!stream) continue;
    let pending = "";
    let overflow = false;
    const receive = chunk => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\n") {
          if (!overflow && diagnostics.isStartupDiagnosticLine(pending.replace(/\r$/, ""))) onLine(pending.replace(/\r$/, ""));
          pending = ""; overflow = false;
        } else if (!overflow) {
          if (pending.length === 256) { pending = ""; overflow = true; }
          else pending += character;
        }
      }
    };
    stream.on("data", receive);
    listeners.push(() => stream.off("data", receive));
  }
  return () => { for (const dispose of listeners) dispose(); };
}

/** Bound an operation on the Electron process created by this QA invocation.
 * Timeout is always a qualification failure; forced exit never proves clean shutdown. */
export async function installedAppPhase(application, phase, operation, { timeoutMs = 180000, onForcedStop = () => {} } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180000) throw new Error("Invalid installed application phase bound");
  const child = application.process();
  if (!child || !Number.isSafeInteger(child.pid) || child.pid <= 0 || typeof child.kill !== "function") {
    throw new Error("Installed application process ownership unavailable");
  }
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          try { onForcedStop(); } catch { /* Optional diagnostics cannot prevent owned-process termination. */ }
          try { child.kill("SIGKILL"); } catch { /* The qualification still fails if termination cannot be confirmed. */ }
          reject(new Error(`Installed application phase timed out: ${phase}`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
