import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export function isApplicationNavigation(value, origin) {
  try {
    const url = new URL(value);
    return url.origin === origin && !url.username && !url.password;
  } catch { return false; }
}

export function externalBrowserUrl(value, origin) {
  try {
    if (typeof value !== "string" || value.length > 8192) return null;
    const url = new URL(value);
    if (url.username || url.password) return null;
    return url.protocol === "https:" || (url.protocol === "http:" && url.origin === origin) ? url.href : null;
  } catch { return null; }
}

export function configureWindowNavigation(contents, { getOrigin, openExternal }) {
  const guard = (event, url = event.url) => {
    if (!isApplicationNavigation(url, getOrigin())) event.preventDefault();
  };
  contents.on("will-navigate", guard);
  contents.on("will-redirect", guard);
  contents.on("will-frame-navigate", event => guard(event));
  contents.setWindowOpenHandler(({ url }) => {
    // Only a currently loaded application page may hand an HTTP(S) provider
    // authorization link to the system browser. Never create another renderer.
    if (isApplicationNavigation(contents.getURL(), getOrigin())) {
      const target = externalBrowserUrl(url, getOrigin());
      if (target) openExternal(target);
    }
    return { action: "deny" };
  });
}

export function desktopEnvironment({ dataDir, port, inherited = process.env }) {
  // Keep executable discovery for explicitly configured local providers, but
  // never inherit routing, provider credentials, Node preloads or telemetry.
  const env = {};
  const keys = ["PATH", "Path", "SystemRoot", "WINDIR", "SystemDrive", "ComSpec",
    "PATHEXT", "LANG", "LC_ALL", "TMPDIR", "TEMP", "TMP"];
  for (const key of keys) if (inherited[key]) env[key] = inherited[key];
  return {
    ...env,
    HOME: dataDir, USERPROFILE: dataDir,
    APPDATA: path.join(dataDir, "AppData/Roaming"), LOCALAPPDATA: path.join(dataDir, "AppData/Local"),
    XDG_CONFIG_HOME: path.join(dataDir, "config"), XDG_CACHE_HOME: path.join(dataDir, "cache"),
    PAPERCLIP_HOME: dataDir, PAPERCLIP_CONFIG: path.join(dataDir, "config.json"),
    PAPERCLIP_DISABLE_CWD_ENV_FILE: "true", PAPERCLIP_INSTANCE_ID: "desktop",
    PAPERCLIP_MIGRATION_PROMPT: "never", PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
    PAPERCLIP_DEPLOYMENT_MODE: "authenticated", PAPERCLIP_DEPLOYMENT_EXPOSURE: "private",
    HOST: "127.0.0.1", PORT: String(port),
    PAPERCLIP_AUTH_PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
    BETTER_AUTH_SECRET: persistentAuthSecret(dataDir),
    BOSTAN_OFFLINE: "1", BOSTAN_FEEDBACK_EXPORT_ENABLED: "0",
    DO_NOT_TRACK: "1", OTEL_SDK_DISABLED: "true", NODE_ENV: "production", SERVE_UI: "true",
  };
}

export function persistentAuthSecret(directory) {
  const file = path.join(directory, "desktop-auth-secret");
  try {
    fs.writeFileSync(file, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== 64) {
    throw new Error("Bostan desktop authentication state is unsafe; restore it from a trusted backup");
  }
  const secret = fs.readFileSync(file, "utf8");
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error("Bostan desktop authentication state is invalid");
  return secret;
}
