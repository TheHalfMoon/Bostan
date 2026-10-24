import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * A local Bostan runtime lock is not a disposable cache file. A database can
 * outlive its server launcher, so removing the lock requires independent proof
 * that the private PostgreSQL cluster has stopped.
 */
export const RUNTIME_MARKER = "bostan-managed-source-runtime-v1";

function checkedStat(target, directory = false) {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()
      || (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)
      || (typeof process.getuid === "function" && stat.uid !== process.getuid())) {
      throw new Error("Unsafe Bostan runtime entry: " + target);
    }
    if (!directory && (stat.mode & 0o077)) {
      throw new Error("Bostan runtime lock is readable by other users");
    }
    return stat;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function parseLock(content) {
  const match = /^bostan-managed-source-runtime-v1:([1-9][0-9]*)\n$/.exec(content);
  if (!match) throw new Error("Unrecognized Bostan runtime lock; manual inspection required");
  const pid = Number(match[1]);
  if (!Number.isSafeInteger(pid)) throw new Error("Invalid Bostan runtime PID");
  return pid;
}

function ownerStatus(pid, probe) {
  try {
    probe(pid, 0);
    return "alive";
  } catch (error) {
    if (error?.code === "ESRCH") return "dead";
    // EPERM means a process exists but is inaccessible, not that it has died.
    if (error?.code === "EPERM") return "alive";
    throw error;
  }
}

export function inspectRuntimeLock(lockPath, probe = process.kill.bind(process)) {
  const stat = checkedStat(lockPath);
  if (!stat) return { state: "absent" };
  const content = fs.readFileSync(lockPath, "utf8");
  const pid = parseLock(content);
  return { state: ownerStatus(pid, probe), pid, content, inode: stat.ino, device: stat.dev };
}

/** pg_ctl exit status 3 is the only positive proof of a stopped initialized cluster. */
export function databaseStatus(pgCtl, dataDir, env = process.env) {
  if (!checkedStat(dataDir, true)) return "not-initialized";
  if (!pgCtl) return "unknown";
  const result = spawnSync(pgCtl, ["-D", dataDir, "status"], {
    env, timeout: 8_000, encoding: "utf8", stdio: "ignore",
  });
  if (result.error) return "unknown";
  if (result.status === 3) return "stopped";
  if (result.status === 0) return "running";
  return "unknown";
}

export function removeStoppedRuntimeLock({
  lockPath, pgData, pgCtl, expectedPid, env = process.env,
  probe = process.kill.bind(process), mode = "recovery",
}) {
  const state = inspectRuntimeLock(lockPath, probe);
  if (state.state === "absent") return { changed: false, reason: "No managed Bostan runtime lock exists" };
  if (mode === "recovery") {
    if (state.state !== "dead") throw new Error("Bostan runtime owner is alive; refusing recovery");
  } else if (mode === "shutdown") {
    if (!Number.isSafeInteger(expectedPid) || state.pid !== expectedPid) {
      throw new Error("Bostan runtime lock changed ownership during shutdown");
    }
  } else {
    throw new Error("Unknown Bostan runtime lock operation");
  }

  const postgres = databaseStatus(pgCtl, pgData, env);
  if (postgres !== "stopped" && postgres !== "not-initialized") {
    throw new Error("Bostan PostgreSQL is running or cannot be verified stopped (" + postgres + "); lock retained");
  }

  // Do not delete a replaced or concurrently adopted lock.
  const next = checkedStat(lockPath);
  if (!next || next.ino !== state.inode || next.dev !== state.device
    || fs.readFileSync(lockPath, "utf8") !== state.content) {
    throw new Error("Bostan runtime lock changed while checking PostgreSQL; lock retained");
  }
  fs.unlinkSync(lockPath);
  return { changed: true, reason: "Verified stopped PostgreSQL and cleared Bostan-only runtime lock" };
}

export function recoverStoppedLocalRuntime({
  home, pgCtl, env = process.env, probe = process.kill.bind(process),
}) {
  if (!home || !path.isAbsolute(home) || home !== path.normalize(home) || !checkedStat(home, true)) {
    throw new Error("An existing, normalized and real HOME directory is required for Bostan recovery");
  }
  const app = path.join(home, ".bostan", "app");
  for (const directory of [path.join(home, ".bostan"), app, path.join(app, "postgres")]) {
    if (!checkedStat(directory, true) && fs.existsSync(path.join(app, "run.lock"))) {
      throw new Error("Incomplete Bostan runtime directory hierarchy; refusing recovery");
    }
  }
  return removeStoppedRuntimeLock({
    lockPath: path.join(app, "run.lock"),
    pgData: path.join(app, "postgres", "data"),
    pgCtl, env, probe,
  });
}
