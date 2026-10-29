import { lstat } from "node:fs/promises";
import { basename, dirname, isAbsolute, parse, relative, resolve, sep } from "node:path";

const ALLOWED_OUTPUT_NAMES = new Set(["runtime", "dist-runtime"]);
const failure = () => new Error("Bostan compiled runtime output directory is not safely isolated");

function isWithin(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/**
 * Admit only a dedicated, non-linked runtime directory beside the compiled
 * entry or beside its dist directory. This must run before recursive removal.
 * Never follow an existing junction/symlink at any output path component.
 */
export async function assertSafeRuntimeOutdir(entry, outdir) {
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

  // Walk from the volume root, checking the path itself rather than following
  // symlinks. Refuse missing parents, symlinks, junctions, and non-directories.
  let cursor = parse(target).root;
  const components = relative(cursor, target).split(sep).filter(Boolean);
  for (let i = 0; i < components.length; i++) {
    cursor = resolve(cursor, components[i]);
    let info;
    try { info = await lstat(cursor); }
    catch (error) {
      if (error?.code === "ENOENT" && i === components.length - 1) return target;
      throw failure();
    }
    if (info.isSymbolicLink() || !info.isDirectory()) throw failure();
  }
  return target;
}
