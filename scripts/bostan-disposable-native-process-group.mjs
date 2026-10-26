/**
 * A narrowly scoped *test-only* POSIX process-group owner.
 * Never send a negative PID to an unrelated system or user process.
 */
export function ownedNativeQaGroupAdmission(env = process.env, platform = process.platform) {
  return env.BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E === "1" &&
    ["darwin", "linux"].includes(platform);
}

export function createOwnedNativeQaProcessGroup(child, detached, platform = process.platform) {
  if (!detached || !["darwin", "linux"].includes(platform) ||
    !Number.isSafeInteger(child?.pid) || child.pid < 2 ||
    child.pid === process.pid) {
    throw new Error("Only a launched, detached, owned POSIX QA child may control its process group");
  }
  // The caller creates the process via spawn({detached:true}) in this QA.
  // The process-group ID is the spawned child's PID, not an arbitrary ID.
  return Object.freeze({ ownerPid: child.pid, platform });
}

export function terminateOwnedNativeQaProcessGroup(owner, signal = "SIGTERM", send = process.kill) {
  if (!owner || !["darwin", "linux"].includes(owner.platform) ||
    !Number.isSafeInteger(owner.ownerPid) || owner.ownerPid < 2 ||
    owner.ownerPid === process.pid || !["SIGTERM", "SIGKILL"].includes(signal)) {
    throw new Error("Invalid owned disposable native QA process group");
  }
  try {
    // Unix negative PID addresses the whole group, including native runnerd
    // children that have outlived the launcher, not a random process tree.
    send(-owner.ownerPid, signal);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}
