import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { inspectRuntimeLock, databaseStatus } from "./bostan-runtime-recovery.mjs";

const CONTROL_MARKER = "bostan-windows-temp-stop-v1";
function stopPath(home) { return path.join(home, ".bostan", "app", "stop-control.json"); }
export function checkWindowsTempStopHome(home, env = process.env) {
  if (process.platform !== "win32" || env.BOSTAN_WINDOWS_TEMP_QA !== "1"
    || !home || !path.isAbsolute(home) || path.normalize(home) !== home) {
    throw new Error("Windows private local stop requires explicit disposable TEMP QA");
  }
  const root = fs.realpathSync(os.tmpdir()).toLowerCase();
  const resolved = fs.realpathSync(home).toLowerCase();
  if (!resolved.startsWith(root + path.sep)
    || fs.lstatSync(home).isSymbolicLink()
    || !fs.lstatSync(home).isDirectory()) {
    throw new Error("Refusing stop control outside disposable TEMP HOME");
  }
  return stopPath(home);
}
function checkSecret(candidate, expected) {
  if (!/^[a-f0-9]{64}$/.test(candidate)) return false;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex"));
}
function readControl(file) {
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1) {
    throw new Error("Unsafe Bostan stop control metadata");
  }
  const v = JSON.parse(fs.readFileSync(file, "utf8"));
  if (v.marker !== CONTROL_MARKER || !Number.isSafeInteger(v.pid) || v.pid < 1
    || !Number.isSafeInteger(v.port) || v.port < 1024 || v.port > 65535
    || !/^[a-f0-9]{64}$/.test(v.token)) {
    throw new Error("Unrecognized Bostan stop controller");
  }
  return v;
}

/** Start after the private root ACL is already enforced and the managed
 * runtime lock is written. Only loopback is reachable, and an unguessable
 * bearer value remains in the ACL-guarded TEMP profile. */
export async function startPrivateStopControl({ home, onStop, pid = process.pid }) {
  const file = checkWindowsTempStopHome(home);
  if (typeof onStop !== "function" || !Number.isSafeInteger(pid) || pid < 1) {
    throw new Error("Invalid private stop listener");
  }
  const token = randomBytes(32).toString("hex");
  let requested = false;
  const server = net.createServer((socket) => {
    socket.setTimeout(3000);
    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
      if (data.length > 512) { socket.destroy(); return; }
      if (data.includes("\n")) {
        const supplied = data.slice(0, data.indexOf("\n"));
        if (!checkSecret(supplied, token)) {
          socket.end("DENIED\n"); return;
        }
        socket.end("ACCEPTED\n");
        if (!requested) {
          requested = true;
          // A stop is only requested here; the parent still must await child
          // service drain and independently verify Postgres stopped.
          queueMicrotask(() => {
            try { onStop(); }
            catch {
              // The authenticated request is not proof of a stopped runtime.
              // The client independently waits for the managed lock to clear
              // and databaseStatus() to prove the database stopped.
              process.stderr.write("Bostan private stop request handler failed.\n");
            }
          });
        }
      }
    });
    socket.on("timeout", () => socket.destroy());
    socket.on("error", () => {});
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const port = server.address().port;
    fs.writeFileSync(file, JSON.stringify({
      marker: CONTROL_MARKER, pid, port, token,
    }) + "\n", { flag: "wx", mode: 0o600 });
    return {
      file,
      close: async () => {
        await new Promise((resolve) => server.close(resolve));
        const current = readControl(file);
        if (current.pid !== pid || !checkSecret(current.token, token)) {
          throw new Error("Bostan stop metadata changed ownership");
        }
        fs.unlinkSync(file);
      },
    };
  } catch (error) {
    server.close();
    throw error;
  }
}

/** This is not a process kill: the launcher must accept an authenticated
 * local request, then quit on its own after child and database shutdown. */
export async function requestPrivateLocalStop({ home, pgCtl, env = process.env, maxWaitMs = 90_000 }) {
  const file = checkWindowsTempStopHome(home, env);
  const lock = inspectRuntimeLock(path.join(home, ".bostan", "app", "run.lock"));
  if (lock.state !== "alive") throw new Error("No live Bostan source runtime to stop");
  const control = readControl(file);
  if (control.pid !== lock.pid) throw new Error("Bostan stop control does not match active runtime owner");
  const answer = await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: control.port });
    let response = "";
    socket.setTimeout(5000);
    socket.on("connect", () => socket.write(control.token + "\n"));
    socket.on("data", chunk => { response += chunk.toString(); if (response.includes("\n")) socket.end(); });
    socket.on("end", () => resolve(response.trim()));
    socket.on("timeout", () => { socket.destroy(); reject(new Error("Bostan stop controller timed out")); });
    socket.on("error", reject);
  });
  if (answer !== "ACCEPTED") throw new Error("Bostan runtime rejected local stop request");
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (inspectRuntimeLock(path.join(home, ".bostan", "app", "run.lock")).state === "absent") {
      const db = databaseStatus(pgCtl, path.join(home, ".bostan", "app", "postgres", "data"), env);
      if (db === "stopped" || db === "not-initialized") {
        return { stopped: true, postgres: db };
      }
      throw new Error("Bostan runtime lock disappeared but PostgreSQL is not verified stopped");
    }
  }
  throw new Error("Bostan orderly stop remains incomplete; lock retained or runtime still running");
}
