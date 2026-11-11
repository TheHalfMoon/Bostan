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
