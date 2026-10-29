/**
 * An allowlisted environment for the isolated Windows Bostan HTTP QA child.
 * Never spread or forward the operator's process.env to a synthetic server.
 */
import {win32} from "node:path";

const SYSTEM_KEYS = Object.freeze([
  "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "PATH",
  "SystemDrive", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS",
]);

export function buildPrivateWindowsHttpQaEnvironment({
  inherited = {}, home, origin, connectionString, port, marker, secret, serveUi = false,
} = {}) {
  if (![home, marker, secret].every(value => typeof value === "string" && value.length > 0))
    throw Error("Missing isolated private QA fixture input");
  if (typeof serveUi !== "boolean")throw Error("Private Windows QA UI flag invalid");
  const portNumber = Number(port);
  if (!Number.isSafeInteger(portNumber) || portNumber < 1024 || portNumber > 65535 ||
      origin !== `http://127.0.0.1:${portNumber}`)
    throw Error("Private Windows QA requires an ephemeral loopback HTTP origin");
  let database;
  try { database = new URL(connectionString); } catch { throw Error("Invalid private QA database URL"); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) ||
      database.hostname !== "127.0.0.1" ||
      !Number.isSafeInteger(Number(database.port)) ||
      Number(database.port) < 1024 || Number(database.port) > 65535)
    throw Error("Private Windows QA requires an isolated loopback PostgreSQL URL");

  const systemValues = new Map(Object.entries(inherited).map(([key, value]) => [key.toUpperCase(), value]));
  const result = {};
  for (const key of SYSTEM_KEYS) {
    const value = systemValues.get(key.toUpperCase());
    if (typeof value === "string" && value.length > 0) result[key] = value;
  }
  // Every writable application or OS temp directory is owned by this probe.
  // Do not inherit operator APPDATA, LOCALAPPDATA, TMP or cached config paths.
  return {
    ...result,
    HOME:home, USERPROFILE:home, TEMP:home, TMP:home,
    APPDATA:win32.join(home,"AppData","Roaming"),
    LOCALAPPDATA:win32.join(home,"AppData","Local"),
    XDG_CONFIG_HOME:home, PAPERCLIP_HOME:home,
    PAPERCLIP_CONFIG:win32.join(home,"never-created-config.json"),
    PAPERCLIP_TEST_POSTGRES_TEMPLATE:"0",
    PAPERCLIP_MIGRATION_PROMPT:"never", PAPERCLIP_MIGRATION_AUTO_APPLY:"true",
    PAPERCLIP_DEPLOYMENT_MODE:"authenticated",
    PAPERCLIP_DEPLOYMENT_EXPOSURE:"private",
    PAPERCLIP_AUTH_PUBLIC_BASE_URL:origin,
    PAPERCLIP_AUTH_BASE_URL_MODE:"explicit",
    PAPERCLIP_AUTH_DISABLE_SIGN_UP:"false",
    PAPERCLIP_AUTH_RATE_LIMIT_ENABLED:"false",
    BETTER_AUTH_SECRET:secret,
    BOSTAN_PRIVATE_QA_ENTRY:"B087_TEST_ONLY",
    BOSTAN_PRIVATE_QA_MARKER:marker,
    DATABASE_URL:connectionString,
    HOST:"127.0.0.1", PORT:String(portNumber),
    PAPERCLIP_OPEN_ON_LISTEN:"false", SERVE_UI:serveUi?"true":"false",
    HEARTBEAT_SCHEDULER_ENABLED:"false",
    BOSTAN_FEEDBACK_EXPORT_ENABLED:"0", OTEL_SDK_DISABLED:"true",
    DO_NOT_TRACK:"1", CI:"1", PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:"1",
  };
}
