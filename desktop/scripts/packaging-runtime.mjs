import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

function inside(root, file) {
  const relative = path.relative(root, file);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep));
}

async function digest(file) {
  const hash = createHash("sha256");
  for await (const bytes of fs.createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}

/** Capture the actual portable runtime after Windows link serialization. */
export async function captureRuntimePayload(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe packaged Bostan runtime root");
  const root = fs.realpathSync(directory);
  const files = [];
  async function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      const relative = path.relative(root, file).split(path.sep).join("/");
      if (entry.isSymbolicLink()) {
        const target = fs.readlinkSync(file);
        if (path.isAbsolute(target) || !inside(root, fs.realpathSync(file))) throw new Error("Non-portable Bostan runtime link");
        files.push({ path: relative, kind: "link", target: target.split(path.sep).join("/") });
      } else if (entry.isDirectory()) {
        await walk(file);
      } else if (entry.isFile()) {
        files.push({ path: relative, kind: "file", sha256: await digest(file), executable: Boolean(fs.statSync(file).mode & 0o111) });
      } else {
        throw new Error("Unsupported Bostan runtime payload entry");
      }
    }
  }
  await walk(root);
  for (const required of ["package.json", "dist/index.js", "ui-dist/index.html"]) {
    if (!files.some(file => file.path === required && file.kind === "file")) throw new Error("Incomplete packaged Bostan runtime");
  }
  return files;
}

export function packagedRuntimePath(context) {
  const resources = context.electronPlatformName === "darwin"
    ? path.join(context.appOutDir, context.packager.appInfo.productFilename + ".app", "Contents", "Resources")
    : path.join(context.appOutDir, "resources");
  return path.join(resources, "runtime");
}

/** electron-builder always filters a source root's node_modules directory.
 * A separate source root is required to include the verified production graph. */
export function runtimeResourceEntries(stage, payload) {
  const entries = [{ from: stage, to: "runtime" },
    { from: path.join(stage, "node_modules"), to: "runtime/node_modules" }];
  // builder-util's directory walker also skips these names unconditionally.
  // Explicit file sources bypass that walker and preserve the verified bytes.
  for (const file of payload) {
    if (file.kind !== "file" || ![".gitkeep", ".DS_Store"].includes(path.posix.basename(file.path))) continue;
    if (/[\\:\x00-\x1f]/.test(file.path) || path.posix.isAbsolute(file.path)
        || file.path.split("/").some(segment => !segment || segment === "." || segment === "..")) {
      throw new Error("Non-portable Bostan runtime metadata path");
    }
    entries.push({ from: path.join(stage, file.path), to: "runtime/" + file.path });
  }
  return entries;
}

/** Fail packaging before accepting an installer if any runtime byte, link or
 * executable bit was lost/changed, or if an unexpected payload was added. */
export async function verifyPackagedRuntime(context, expected) {
  const actual = await captureRuntimePayload(packagedRuntimePath(context));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const expectedByPath = new Map(expected.map(entry => [entry.path, entry]));
    const actualByPath = new Map(actual.map(entry => [entry.path, entry]));
    const counts = { missing: 0, unexpected: 0, changed: 0 };
    const sample = [];
    for (const file of new Set([...expectedByPath.keys(), ...actualByPath.keys()])) {
      const before = expectedByPath.get(file), after = actualByPath.get(file);
      const kind = !after ? "missing" : !before ? "unexpected" : JSON.stringify(before) !== JSON.stringify(after) ? "changed" : null;
      if (!kind) continue;
      counts[kind]++;
      if (sample.length < 8) sample.push({
        path: file.slice(0, 200), kind,
        fields: kind === "changed" ? ["kind", "sha256", "executable", "target"].filter(key => before[key] !== after[key]) : [],
      });
    }
    // Build diagnostics contain only bounded relative package paths and field
    // names, never file contents, link destinations or local absolute paths.
    throw new Error(`Packaged Bostan runtime differs from the verified stage: ${JSON.stringify({ counts, sample })}`);
  }
}
