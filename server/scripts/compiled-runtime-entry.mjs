import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

/** Node ESM does not accept native Windows drive paths as import specifiers.
 * Keep process.argv[1] native for legacy entrypoint detection, but encode
 * every dynamically imported/external absolute file as a file: URL.
 */
export function nativeEsmFileUrl(filename) {
  if (typeof filename !== "string" || !isAbsolute(filename) || filename.includes("\0") ||
      (process.platform === "win32" && /^\\\\/.test(filename))) {
    throw new TypeError("Bostan compiled runtime requires an absolute local file path");
  }
  return pathToFileURL(filename).href;
}

export function compiledRuntimeEntrySource(entry) {
  const url = nativeEsmFileUrl(entry);
  // Keep the URL expression dynamic: esbuild cannot resolve file: URLs as
  // bundle inputs, but Node must receive a file: URL at runtime on Windows.
  return `process.argv[1] = ${JSON.stringify(entry)};\nawait import(new URL(${JSON.stringify(url)}).href);\n`;
}
