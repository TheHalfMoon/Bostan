import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  ownedNativeQaGroupAdmission, createOwnedNativeQaProcessGroup,
  terminateOwnedNativeQaProcessGroup,
} from "./bostan-disposable-native-process-group.mjs";

test("process group cleanup is reserved for an explicitly opted-in POSIX governed Case QA", () => {
  assert.equal(ownedNativeQaGroupAdmission({}, "darwin"), false);
  assert.equal(ownedNativeQaGroupAdmission({ BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E: "1" }, "win32"), false);
  for (const platform of ["darwin", "linux"]) {
    assert.equal(ownedNativeQaGroupAdmission({
      BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E: "1",
    }, platform), true);
  }
});

test("no random PID, current process, unowned or nondetached child is signaled", () => {
  for (const value of [
    undefined, {}, {pid: 1}, {pid: process.pid}, {pid: -23}, {pid: "123"},
  ]) {
    assert.throws(() => createOwnedNativeQaProcessGroup(value, true, "darwin"));
  }
  assert.throws(() => createOwnedNativeQaProcessGroup({pid: 12345}, false, "darwin"));
  assert.throws(() => createOwnedNativeQaProcessGroup({pid: 12345}, true, "win32"));
  const owner = createOwnedNativeQaProcessGroup({pid: 12345}, true, "darwin");
  const calls = [];
  assert.equal(terminateOwnedNativeQaProcessGroup(owner, "SIGTERM", (...args) => calls.push(args)), true);
  assert.deepEqual(calls, [[-12345, "SIGTERM"]]);
  assert.throws(() => terminateOwnedNativeQaProcessGroup(owner, "SIGUSR1", () => {}));
  assert.equal(terminateOwnedNativeQaProcessGroup(owner, "SIGTERM", () => {
    const error = Error("synthetic dead process group");
    error.code = "ESRCH";
    throw error;
  }), false);
  assert.throws(() => terminateOwnedNativeQaProcessGroup(owner, "SIGTERM", () => {
    const error = Error("not authorized");
    error.code = "EPERM";
    throw error;
  }));
});

test("real detached synthetic test group can be stopped without killing this parent", {
  skip: !["darwin", "linux"].includes(process.platform), timeout: 10_000,
}, async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    detached: true, stdio: "ignore",
  });
  const owner = createOwnedNativeQaProcessGroup(child, true);
  try {
    // The OS allocates the detached POSIX group on spawn. Wait until the
    // child's process is confirmed live before sending the group signal.
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    assert.equal(terminateOwnedNativeQaProcessGroup(owner), true);
    let watchdog;
    const outcome = await Promise.race([
      new Promise((resolve, reject) => {
        child.once("exit", (code, signal) => resolve({code, signal}));
        child.once("error", reject);
      }),
      new Promise((_, reject) => {
        watchdog = setTimeout(() =>
          reject(Error("Owned synthetic QA process did not stop after group SIGTERM")), 6000);
      }),
    ]).finally(() => clearTimeout(watchdog));
    assert.equal(outcome.signal, "SIGTERM");
    assert.equal(process.kill(process.pid, 0), true);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      try { terminateOwnedNativeQaProcessGroup(owner, "SIGKILL"); } catch {}
      child.kill("SIGKILL");
    }
  }
});
