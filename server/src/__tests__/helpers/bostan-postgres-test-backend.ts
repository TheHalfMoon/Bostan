/**
 * Bostan-only test harness. An explicit opt-in lets developers use an installed
 * PostgreSQL binary when the imported embedded native image does not run.
 * It never connects to or drops a user's existing PostgreSQL service.
 */
import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  applyPendingMigrations,
  closeRegisteredClients,
  ensurePostgresDatabase,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
  type EmbeddedPostgresTestDatabase,
} from "@paperclipai/db";

const execFile = promisify(execFileCallback);
const SYSTEM_OPT_IN = "system";
const SYSTEM_TIMEOUT_MS = 120_000;
const TEMP_PREFIX = "bostan-isolated-pg-";

export function isBostanSystemPostgresTestMode(env = process.env): boolean {
  return env.BOSTAN_TEST_POSTGRES_BACKEND === SYSTEM_OPT_IN;
}

async function run(binary: string, args: string[]): Promise<void> {
  await execFile(binary, args, { timeout: SYSTEM_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 });
}

async function freePort(): Promise<number> {
  const listener = net.createServer();
  return await new Promise((resolve, reject) => {
    listener.on("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const bound = listener.address();
      if (!bound || typeof bound === "string") {
        listener.close(() => reject(new Error("No isolated PostgreSQL port")));
      } else {
        listener.close((error) => error ? reject(error) : resolve(bound.port));
      }
    });
  });
}

function binaries() {
  const dir = process.env.BOSTAN_TEST_POSTGRES_BIN_DIR?.trim();
  // No arbitrary shell interpolation; execFile invokes these as executables.
  if (dir && !path.isAbsolute(dir)) throw new Error("Bostan test postgres binary directory must be absolute");
  return {
    initdb: dir ? path.join(dir, "initdb") : "initdb",
    pgCtl: dir ? path.join(dir, "pg_ctl") : "pg_ctl",
  };
}

export async function getBostanFeedbackPostgresTestSupport() {
  if (!isBostanSystemPostgresTestMode()) return getEmbeddedPostgresTestSupport();
  try {
    const { initdb, pgCtl } = binaries();
    await run(initdb, ["--version"]);
    await run(pgCtl, ["--version"]);
    return { supported: true, reason: "isolated system PostgreSQL opt-in" };
  } catch (error) {
    return { supported: false, reason: `Bostan isolated PostgreSQL binaries unavailable: ${String(error)}` };
  }
}

export async function startBostanFeedbackPostgresTestDatabase(
  prefix: string,
): Promise<EmbeddedPostgresTestDatabase> {
  if (!isBostanSystemPostgresTestMode()) return startEmbeddedPostgresTestDatabase(prefix);

  // The prefix supplied by tests does not determine the root. This path is
  // created by mkdtemp and deleted ONLY by the matching cleanup closure.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  fs.chmodSync(root, 0o700);
  const data = path.join(root, "cluster");
  const logs = path.join(root, "postgres.log");
  const port = await freePort();
  const { initdb, pgCtl } = binaries();
  let cleaned = false;
  const stop = async () => {
    if (cleaned) return;
    // Even an interrupted `pg_ctl start` can leave a live database. Confirm
    // it stopped before removing its data directory, or preserve evidence.
    if (fs.existsSync(data)) {
      try {
        await run(pgCtl, ["-D", data, "-m", "immediate", "-w", "stop"]);
      } catch {
        try {
          await run(pgCtl, ["-D", data, "status"]);
        } catch {
          // pg_ctl status nonzero: no running server attached to the dir.
          cleaned = true;
          fs.rmSync(root, { recursive: true, force: true });
          return;
        }
        throw new Error(`Isolated Bostan PostgreSQL did not stop: ${data}; test data preserved`);
      }
    }
    cleaned = true;
    fs.rmSync(root, { recursive: true, force: true });
  };

  try {
    await run(initdb, ["-D", data, "-U", "bostan_test", "--auth=trust", "--encoding=UTF8", "--locale=C", "--no-instructions"]);
    const options = `-h 127.0.0.1 -p ${port} -c unix_socket_directories=${root} -c fsync=off`;
    await run(pgCtl, ["-D", data, "-l", logs, "-o", options, "-w", "start"]);
    const adminUrl = `postgres://bostan_test@127.0.0.1:${port}/postgres`;
    const connectionString = `postgres://bostan_test@127.0.0.1:${port}/bostan_test`;
    await ensurePostgresDatabase(adminUrl, "bostan_test");
    await applyPendingMigrations(connectionString);
    return {
      connectionString,
      cleanup: async () => {
        await closeRegisteredClients(connectionString);
        await stop();
      },
    };
  } catch (error) {
    const recentLogs = fs.existsSync(logs) ? fs.readFileSync(logs, "utf8").slice(-1500) : "";
    await stop();
    throw new Error(`Bostan isolated PostgreSQL test bootstrap failed: ${String(error)} ${recentLogs}`);
  }
}
