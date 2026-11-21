import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Keep jsdom's large DOM dependency graph off the server startup path. */
export function loadJSDOM(): typeof import("jsdom") {
  return require("jsdom") as typeof import("jsdom");
}
