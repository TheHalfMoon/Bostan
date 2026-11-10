import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/** Select an actual compiled entry; never fall back to the source loader. */
export function serverJourneyCommand(repo, compiled = false) {
  const entry = path.join(repo, "server", compiled ? "dist/index.js" : "src/index.ts");
  if (!fs.statSync(entry, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Bostan ${compiled ? "compiled" : "source"} server entry is missing; build it before qualification`);
  }
  return compiled
    ? ["--conditions=bostan-compiled", entry]
    : [path.join(repo, "server/node_modules/tsx/dist/cli.mjs"), entry];
}

/** Synthetic server state must never inherit an operator's DB/config/keys. */
export function serverJourneyEnvironment({ home, base, port, compiled, inherited = process.env }) {
  const env = {};
  for (const key of ["SystemRoot", "WINDIR", "SystemDrive", "ComSpec", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS"]) {
    if (inherited[key]) env[key] = inherited[key];
  }
  return {
    ...env,
    PATH: [path.dirname(process.execPath), path.join(env.SystemRoot || "C:\\Windows", "System32")].join(path.delimiter),
    HOME: home, USERPROFILE: home, TEMP: home, TMP: home,
    APPDATA: path.join(home, "AppData/Roaming"), LOCALAPPDATA: path.join(home, "AppData/Local"),
    PAPERCLIP_HOME: home, PAPERCLIP_CONFIG: path.join(home, "config.json"),
    PAPERCLIP_DISABLE_CWD_ENV_FILE: "true", PAPERCLIP_INSTANCE_ID: "windows-journey",
    PAPERCLIP_MIGRATION_PROMPT: "never", PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
    PORT: String(port), HOST: "127.0.0.1",
    PAPERCLIP_DEPLOYMENT_MODE: "authenticated", PAPERCLIP_DEPLOYMENT_EXPOSURE: "private",
    PAPERCLIP_AUTH_PUBLIC_BASE_URL: base, BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BOSTAN_OFFLINE: "1", DO_NOT_TRACK: "1", OTEL_SDK_DISABLED: "true",
    BOSTAN_FEEDBACK_EXPORT_ENABLED: "0", NODE_ENV: compiled ? "production" : "development",
  };
}
