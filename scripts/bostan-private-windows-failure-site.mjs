import { win32 } from "node:path";

/**
 * Strictly synthetic private Windows QA: turn a stack into ONE repository
 * source location. Never print an exception message, absolute path or stack.
 */
export function safeWindowsStartupSite(stack, root) {
  if (typeof stack !== "string" || typeof root !== "string" ||
      !/^[a-z]:\\/i.test(root)) return "unknown";
  const normalizedRoot = win32.resolve(root);
  for (const frame of stack.split(/\r?\n/).slice(1, 18)) {
    // Only Windows file paths in actual stack frames, not the error message.
    const match = frame.match(/(?:file:\/\/\/)?([a-z]:[\\/][^\s()]*?\.(?:ts|tsx|js|mjs)):(\d{1,7}):\d{1,7}/i);
    if (!match) continue;
    const absolute = win32.resolve(match[1].replaceAll("/", "\\"));
    const relative = win32.relative(normalizedRoot, absolute).replaceAll("\\", "/");
    if (!/^(?:server\/src|packages)\/[a-zA-Z0-9_/-]+\.(?:ts|tsx|js|mjs)$/.test(relative) ||
        relative.includes("/../") || relative.includes("/./") ||
        relative.startsWith("../")) continue;
    const line = Number(match[2]);
    if (!Number.isSafeInteger(line) || line < 1 || line > 999999) continue;
    return relative + ":" + line;
  }
  return "unknown";
}

const PUBLIC_OS_ERROR_CODES = new Set([
  "ENOENT", "EACCES", "EPERM", "EADDRINUSE", "ECONNREFUSED",
  "ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED",
  "42P01", "42703", "28P01", "23505",
]);
export function safeWindowsStartupCode(error) {
  // Do not emit untrusted error messages, arbitrary codes or nested causes.
  const code = error && typeof error === "object" ? error.code : undefined;
  return typeof code === "string" && PUBLIC_OS_ERROR_CODES.has(code) ? code : "unknown";
}

export function safeWindowsMissingPackage(error) {
  if (safeWindowsStartupCode(error) !== "ERR_MODULE_NOT_FOUND" ||
      typeof error?.message !== "string") return "unknown";
  // Node's error includes an importer path and may include user data. Extract
  // ONLY one validated bare package specifier, never the raw message.
  const match = /^Cannot find package ['"]([^'"]{1,100})['"] imported from /.exec(error.message);
  if (!match) return "unknown";
  const name = match[1];
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name) ||
      name.includes("..")) return "unknown";
  return "package:" + name;
}

export function safeWindowsMissingLocalModule(error, root) {
  if (safeWindowsStartupCode(error) !== "ERR_MODULE_NOT_FOUND" ||
      typeof root !== "string" || !/^[a-z]:\\/i.test(root)) return "unknown";
  const message = typeof error?.message === "string" ? error.message : "";
  const match = /^Cannot find module ['"]([^'"\r\n]{1,500})['"] imported from /.exec(message);
  const candidate = typeof error?.url === "string" && error.url.startsWith("file:")
    ? error.url : match?.[1];
  if (typeof candidate !== "string") return "unknown";
  let file = candidate;
  if (file.startsWith("file:")) {
    try { file = new URL(file).pathname.replace(/^\/([a-z]:)/i, "$1"); }
    catch { return "unknown"; }
  }
  if (!/^[a-z]:[\\/]/i.test(file)) return "unknown";
  const relative = win32.relative(win32.resolve(root),
    win32.resolve(file.replaceAll("/", "\\"))).replaceAll("\\", "/");
  if (!/^(?:packages|server)\/[a-zA-Z0-9_./-]+\.(?:ts|tsx|js|mjs|json)$/.test(relative) ||
      relative.includes("/../") || relative.includes("/./") || relative.startsWith("../"))
    return "unknown";
  return "repo:" + relative.slice(0, 180);
}
