/**
 * Bostan private Windows QA: observe only the ChildProcess spawned by this test.
 * A signal/exitCode is NOT completion: wait for the actual `close` event.
 * Never inspect or kill arbitrary PIDs or PostgreSQL descendants.
 */
export function observeOwnedQaChild(child) {
  if (!child || typeof child.once !== 'function' || typeof child.kill !== 'function') {
    throw Error('Expected an owned spawned ChildProcess');
  }
  let closeSeen = false;
  let spawnError = false;
  let forced = false;
  let stopping = null;
  const closed = new Promise(resolve => {
    child.once('close', () => { closeSeen = true; resolve(); });
  });
  // Attach immediately after spawn: otherwise ENOENT emits an unhandled
  // `error` event that can crash the parent before the teardown receipt.
  child.on('error', () => { spawnError = true; });

  async function awaitClose(ms) {
    if (closeSeen) return true;
    let timer;
    try {
      return await Promise.race([
        closed.then(() => true),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), ms); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }
  async function stop({graceMs = 10_000, forceMs = 5_000} = {}) {
    if (!Number.isSafeInteger(graceMs) || graceMs < 1 || graceMs > 60_000 ||
        !Number.isSafeInteger(forceMs) || forceMs < 1 || forceMs > 60_000) {
      throw Error('Invalid bounded child termination limits');
    }
    if (stopping) return stopping;
    stopping = (async () => {
      if (!closeSeen && !spawnError) {
        try { child.kill('SIGTERM'); } catch { /* fail closed below */ }
      }
      if (!await awaitClose(graceMs)) {
        forced = true;
        // Only the handle returned by THIS invocation of spawn is eligible.
        if (!spawnError) {
          try { child.kill('SIGKILL'); } catch { /* keep fixture */ }
        }
        await awaitClose(forceMs);
      }
      return Object.freeze({closed:closeSeen,spawnError,forceUsed:forced});
    })();
    return stopping;
  }
  return {
    stop,
    get exitedOrFailed() { return closeSeen || spawnError; },
    get closeSeen() { return closeSeen; },
    get spawnError() { return spawnError; },
  };
}
