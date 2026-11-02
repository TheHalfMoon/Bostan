/**
 * An allowlisted environment for the isolated Windows Bostan HTTP QA child.
 * Never spread or forward the operator's process.env to a synthetic server.
 */
import {win32} from "node:path";

const SYSTEM_KEYS = Object.freeze([
  "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS",
]);

// This is a string-boundary check, not filesystem ownership attestation.
// The runner must still create HOME with mkdtemp and capture its real inode
// and marker identity before any recursive cleanup is authorized.
function assertPrivateWindowsQaFixtureBoundary(home, marker, secret) {
  const ordinaryDrivePath = value => {
    if (typeof value !== "string" || !/^[A-Za-z]:\\/.test(value) ||
        value.includes("/") || /[\x00-\x1f\x7f]/.test(value) ||
        win32.normalize(value) !== value || value.endsWith("\\")) return false;
    return value.slice(3).split("\\").every(segment =>
      segment.length > 0 && segment !== "." && segment !== ".." &&
      !/[. ]$/.test(segment) && !segment.includes(":"));
  };
  if (!ordinaryDrivePath(home) || !ordinaryDrivePath(marker) ||
      !/^bostan-private-auth-http-[A-Za-z0-9_-]{1,80}$/.test(win32.basename(home)) ||
      marker.toLowerCase() !== win32.join(home, "BOSTAN_QA_OWNED").toLowerCase() ||
      win32.basename(marker) !== "BOSTAN_QA_OWNED" ||
      typeof secret !== "string" || secret.length < 24 || secret.length > 256 ||
      /[\x00-\x1f\x7f]/.test(secret))
    throw Error("Invalid private QA fixture home, marker or secret");
}


export function buildPrivateWindowsHttpQaEnvironment({
  inherited = {}, home, origin, connectionString, port, marker, secret, serveUi = false,
} = {}) {
  if (![home, marker, secret].every(value => typeof value === "string" && value.length > 0))
    throw Error("Missing isolated private QA fixture input");
  assertPrivateWindowsQaFixtureBoundary(home, marker, secret);
  if (typeof serveUi !== "boolean")throw Error("Private Windows QA UI flag invalid");
  const portNumber = Number(port);
  if (!Number.isSafeInteger(portNumber) || portNumber < 1024 || portNumber > 65535 ||
      origin !== `http://127.0.0.1:${portNumber}`)
    throw Error("Private Windows QA requires an ephemeral loopback HTTP origin");
  // This runner creates a synthetic `paperclip` database. Loopback alone
  // cannot distinguish that fixture from a pre-existing local database.
  // Reject other database names, connection options, fragments, missing
  // credentials, and noncanonical URL spellings before forwarding DATABASE_URL.
  let database;
  if (typeof connectionString !== "string")
    throw Error("Invalid private QA database URL");
  try { database = new URL(connectionString); } catch { throw Error("Invalid private QA database URL"); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) ||
      database.hostname !== "127.0.0.1" ||
      !Number.isSafeInteger(Number(database.port)) ||
      Number(database.port) < 1024 || Number(database.port) > 65535 ||
      database.pathname !== "/paperclip" ||
      !database.username || !database.password ||
      database.search !== "" || database.hash !== "" ||
      database.href !== connectionString)
    throw Error("Private Windows QA requires an isolated loopback PostgreSQL URL");

  const systemValues = new Map(Object.entries(inherited).map(([key, value]) => [key.toUpperCase(), value]));
  // Never inherit the operator's executable search path or shell. A Windows
  // QA child may launch subprocesses during server initialization; allowing
  // operator PATH/ComSpec/PATHEXT would redirect them outside the owned fixture.
  // Require an explicit conventional OS root, including for synthetic tests.
  // Missing or noncanonical roots fail closed before spawning a child.
  const rootInput = systemValues.get("SYSTEMROOT");
  const windir = systemValues.get("WINDIR");
  if (typeof rootInput !== "string" ||
      !/^[A-Za-z]:\\Windows\\?$/i.test(rootInput))
    throw Error("Private Windows QA system root invalid");
  const windowsRoot = rootInput.replace(/\\$/, "");
  if (windir !== undefined && (typeof windir !== "string" ||
      !/^[A-Za-z]:\\Windows\\?$/i.test(windir) ||
      windir.replace(/\\$/, "").toLowerCase() !== windowsRoot.toLowerCase()))
    throw Error("Private Windows QA system root invalid");
  const system32 = win32.join(windowsRoot, "System32");
  const result = {
    SystemRoot:windowsRoot, WINDIR:windowsRoot,
    SystemDrive:windowsRoot.slice(0, 2),
    ComSpec:win32.join(system32, "cmd.exe"),
    PATHEXT:".COM;.EXE;.BAT;.CMD", PATH:system32,
  };
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
