import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

/** Node ESM does not accept native Windows drive paths as import specifiers.
 * Keep process.argv[1] native for legacy entrypoint detection, but encode
 * every dynamically imported/external absolute file as a file: URL.
 */
export function nativeEsmFileUrl(filename) {
  if (typeof filename !== "string" || !isAbsolute(filename) || filename.includes("\0") ||
      (process.platform === "win32" && !/^[A-Za-z]:[\\/]/.test(filename))) {
    throw new TypeError("Bostan compiled runtime requires an absolute local file path");
  }
  return pathToFileURL(filename).href;
}

export function compiledRuntimeEntrySource(entry) {
  // Validate the original native entrypoint, but never load that source
  // file at runtime. The bundle's sibling server.mjs is the executable
  // artifact; importing the original dist/index.js bypassed esbuild and
  // silently made the compiled runtime depend on a mutable source tree.
  nativeEsmFileUrl(entry);
  // Preserve the original native argv path for legacy main-module checks.
  // Keep the sibling URL dynamic so esbuild does not resolve it as an input.
  return `process.argv[1] = ${JSON.stringify(entry)};\nawait import(new URL("./server.mjs", import.meta.url).href);\n`;
}
