import fs from "node:fs";
import path from "node:path";

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
