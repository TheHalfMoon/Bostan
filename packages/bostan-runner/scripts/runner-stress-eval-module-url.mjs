import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Node's ESM loader accepts file:// URLs, not native Windows drive paths.
 * Keep the runner's compiled eval entry a URL on every supported OS.
 */
export function runnerStressEvalModuleUrl(packageRoot) {
  return pathToFileURL(resolve(packageRoot, "dist/eval/index.js")).href;
}
