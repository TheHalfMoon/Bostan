import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, parse, relative, resolve, sep, join } from "node:path";

const ALLOWED_OUTPUT_NAMES = new Set(["runtime", "dist-runtime"]);
const MARKER = ".bostan-compiled-runtime-owner.json";
const SCHEMA = "bostan.compiled-runtime-owner.v1";
const MAX_FILES = 10_000;
const MAX_MARKER_BYTES = 1_000_000;
const failure = () => new Error("Bostan compiled runtime output directory is not safely isolated");

function isWithin(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
}

function generatedFileName(name) {
  return typeof name === "string" && name === basename(name) &&
    /^(?:[a-zA-Z0-9_-]+)\.(?:mjs|css)(?:\.map)?$/.test(name);
}

async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function validateLocation(entry, outdir) {
  if (typeof entry !== "string" || typeof outdir !== "string" ||
      !isAbsolute(entry) || !isAbsolute(outdir)) throw failure();
  const source = resolve(entry);
  const target = resolve(outdir);
  const sourceParent = dirname(source);
  const targetParent = dirname(target);
  if (!ALLOWED_OUTPUT_NAMES.has(basename(target)) ||
      (targetParent !== sourceParent && targetParent !== dirname(sourceParent)) ||
      isWithin(target, source) || isWithin(target, process.cwd()) ||
      target === parse(target).root) throw failure();

  // Refuse to erase a previously owned runtime if its source entry is missing,
  // substituted with a link, or no longer a regular file. Otherwise esbuild
  // fails only AFTER the existing runtime has been recursively removed.
  const sourceInfo = await lstat(source).catch(() => null);
  if (!sourceInfo?.isFile() || sourceInfo.isSymbolicLink()) throw failure();
  // A regular final entry can still be reached through a substituted parent
  // symlink or Windows junction. Check every source ancestor before admitting
  // deletion of a previously owned runtime.
  let sourceCursor = parse(source).root;
  for (const component of relative(sourceCursor, sourceParent).split(sep).filter(Boolean)) {
    sourceCursor = resolve(sourceCursor, component);
    const info = await lstat(sourceCursor).catch(() => null);
    if (!info?.isDirectory() || info.isSymbolicLink()) throw failure();
  }

  // lstat every parent: no symlinks, junctions or substituted path roots.
  let cursor = parse(target).root;
  const components = relative(cursor, target).split(sep).filter(Boolean);
  for (let i = 0; i < components.length; i++) {
    cursor = resolve(cursor, components[i]);
    let info;
    try { info = await lstat(cursor); }
    catch (error) {
      if (error?.code === "ENOENT" && i === components.length - 1)
        return { source, target, exists: false };
      throw failure();
    }
    if (info.isSymbolicLink() || !info.isDirectory()) throw failure();
  }
  return { source, target, exists: true };
}

function validManifest(value, source, target) {
  return value && value.schema === SCHEMA && value.entry === source &&
    value.outdir === target && Array.isArray(value.files) &&
    value.files.length >= 2 && value.files.length <= MAX_FILES &&
    value.files.every(item => item && generatedFileName(item.name) &&
      typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256)) &&
    new Set(value.files.map(item => item.name)).size === value.files.length &&
    value.files.some(item => item.name === "index.mjs") &&
    value.files.some(item => item.name === "server.mjs");
}

/**
 * No existing nonempty output can be recursively deleted unless it has an
 * exact marker, an exact generated-file inventory and unchanged SHA-256s.
 * A marker alone is NOT authority to erase newly added personal data.
 */
export async function assertSafeRuntimeOutdir(entry, outdir) {
  const { source, target, exists } = await validateLocation(entry, outdir);
  if (!exists) return target;
  const names = await readdir(target);
  if (names.length === 0) return target;
  if (!names.includes(MARKER)) throw failure();
  const markerFile = join(target, MARKER);
  const stat = await lstat(markerFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MARKER_BYTES)
    throw failure();
  let manifest;
  try { manifest = JSON.parse(await readFile(markerFile, "utf8")); }
  catch { throw failure(); }
  if (!validManifest(manifest, source, target)) throw failure();
  const expectedNames = [MARKER, ...manifest.files.map(item => item.name)].sort();
  if (names.length !== expectedNames.length ||
      names.sort().some((name, i) => name !== expectedNames[i])) throw failure();
  for (const item of manifest.files) {
    const file = join(target, item.name);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() ||
        await digest(file) !== item.sha256) throw failure();
  }
  return target;
}

/**
 * Called only AFTER esbuild successfully writes a fresh directory.
 * Record the exact outputs and contents, never grant blanket directory ownership.
 */
export async function recordRuntimeOutputOwnership(entry, outdir, outputPaths) {
  const { source, target, exists } = await validateLocation(entry, outdir);
  if (!exists || !Array.isArray(outputPaths) ||
      outputPaths.length < 2 || outputPaths.length > MAX_FILES) throw failure();
  const files = [];
  for (const filePath of outputPaths) {
    if (typeof filePath !== "string") throw failure();
    const file = resolve(filePath);
    const name = relative(target, file);
    if (!generatedFileName(name)) throw failure();
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw failure();
    files.push({ name, sha256: await digest(file) });
  }
  const manifest = { schema: SCHEMA, entry: source, outdir: target,
    files: files.sort((a, b) => a.name.localeCompare(b.name)) };
  if (!validManifest(manifest, source, target)) throw failure();
  const names = await readdir(target);
  const expected = files.map(item => item.name).sort();
  if (names.length !== expected.length ||
      names.sort().some((name, i) => name !== expected[i])) throw failure();
  await writeFile(join(target, MARKER), JSON.stringify(manifest) + "\n",
    { flag: "wx", mode: 0o600 });
}
