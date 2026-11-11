import fs from "node:fs";
import path from "node:path";

const manifestName = "bostan-runtime-links.json";
function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}
function targetPath(root, relative, allowRoot = false) {
  if (typeof relative !== "string" || relative.includes("\\") || relative.includes(":")) throw new Error("Invalid runtime link path");
  if (allowRoot && relative === ".") return root;
  if (!relative || relative.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid runtime link path");
  const target = path.resolve(root, relative);
  if (!inside(root, target) || target === root) throw new Error("Runtime link escapes application");
  return target;
}
function checkParents(root, file) {
  for (let parent = path.dirname(file); parent !== root; parent = path.dirname(parent)) {
    const stat = fs.lstatSync(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe runtime link parent");
  }
}

/** Windows junctions contain absolute build paths. Ship their internal mapping
 * as data and recreate them under the actual per-user installation directory.
 * Unix links are rewritten as relative links before signing/packaging instead. */
export function prepareRuntimeLinks(root, platform = process.platform) {
  root = fs.realpathSync(root);
  const links = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const target = fs.realpathSync(file);
        if (!inside(root, target)) throw new Error("Runtime dependency escapes application payload");
        links.push({
          path: path.relative(root, file).split(path.sep).join("/"),
          target: path.relative(root, target).split(path.sep).join("/") || ".",
          kind: fs.statSync(target).isDirectory() ? "dir" : "file",
        });
      } else if (entry.isDirectory()) walk(file);
    }
  }
  walk(root);
  if (links.some(link => link.kind === "file") && platform === "win32") {
    throw new Error("Windows runtime payload contains an unsupported file symlink");
  }
  // Validate every target before changing any link; no external tree is copied.
  for (const link of links) {
    const file = targetPath(root, link.path);
    fs.unlinkSync(file);
    if (platform !== "win32") {
      fs.symlinkSync(path.relative(path.dirname(file), targetPath(root, link.target, true)), file, link.kind);
    }
  }
  if (platform === "win32") {
    // electron-builder copies files/links, dropping empty directories. Once
    // junctions are serialized, their scope parents and even empty targets
    // still have to survive so strict restoration can validate them.
    const directories = new Set(links.flatMap(link => [
      path.dirname(targetPath(root, link.path)),
      targetPath(root, link.target, true),
    ]));
    for (const directory of directories) {
      if (directory !== root) fs.writeFileSync(path.join(directory, ".bostan-runtime-directory"), "", { flag: "wx" });
    }
    fs.writeFileSync(path.join(root, manifestName), JSON.stringify({ schema: "bostan.runtime-links.v1", links }), { flag: "wx" });
  }
  return { links: links.length };
}

export function restoreRuntimeLinks(directory) {
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error("Unsafe runtime directory");
  const root = fs.realpathSync(directory);
  const file = path.join(root, manifestName);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 10_000_000) throw new Error("Invalid runtime link manifest");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (manifest.schema !== "bostan.runtime-links.v1" || !Array.isArray(manifest.links) || manifest.links.length > 50_000) throw new Error("Invalid runtime link manifest");
  const seen = new Set();
  // Refuse substitutions before creating anything. Never overwrite a file,
  // directory, or a link that points anywhere other than its packaged target.
  const links = manifest.links.map(link => {
    if (link.kind !== "dir" || seen.has(link.path)) throw new Error("Invalid runtime link entry");
    seen.add(link.path);
    const location = targetPath(root, link.path);
    const target = targetPath(root, link.target, true);
    checkParents(root, location);
    checkParents(root, target === root ? path.join(root, "unused") : target);
    if (!fs.lstatSync(target).isDirectory() || fs.lstatSync(target).isSymbolicLink()) throw new Error("Invalid runtime link target");
    const existing = fs.lstatSync(location, { throwIfNoEntry: false });
    if (existing && (!existing.isSymbolicLink() || fs.realpathSync(location) !== target)) throw new Error("Runtime link destination is occupied");
    return { location, target, existing };
  });
  for (const link of links) if (!link.existing) fs.symlinkSync(link.target, link.location, process.platform === "win32" ? "junction" : "dir");
}
