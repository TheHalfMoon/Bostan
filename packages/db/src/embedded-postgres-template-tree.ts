import fs from "node:fs";
import path from "node:path";

// Only a self-contained, inspectable, owner-local cluster may be copied or
// reused as a native PostgreSQL test template. Reject unknown filesystem
// object types, links, foreign ownership, mount crossings and oversized trees.
// This check cannot replace an atomic snapshot; repeat after copying.
const MAX_TEMPLATE_ENTRIES = 16384;
const MAX_TEMPLATE_DEPTH = 32;
// Test-only migrated cluster cache: cap the logical bytes copied even when
// an adversarial or stale template contains sparse or oversized files.
// A normal fresh initdb + migrations is far smaller; oversized templates
// must fall back to an independently created fresh cluster.
const MAX_TEMPLATE_FILE_BYTES = 256 * 1024 * 1024;
const MAX_TEMPLATE_TOTAL_BYTES = 512 * 1024 * 1024;

export function isSelfContainedPostgresTemplateTree(root: string): boolean {
  if (typeof root !== "string" || !path.isAbsolute(root)) return false;
  try {
    const anchor = fs.lstatSync(root);
    if (!anchor.isDirectory() || anchor.isSymbolicLink()) return false;
    const uid = process.getuid?.();
    const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
    let entries = 0;
    let totalBytes = 0;
    while (stack.length) {
      const { dir, depth } = stack.pop()!;
      const info = fs.lstatSync(dir);
      if (!info.isDirectory() || info.isSymbolicLink() ||
          info.dev !== anchor.dev ||
          (uid !== undefined && info.uid !== uid) ||
          (uid !== undefined && (info.mode & 0o022) !== 0)) return false;
      const names = fs.readdirSync(dir);
      entries += names.length;
      if (entries > MAX_TEMPLATE_ENTRIES) return false;
      for (const name of names) {
        const file = path.join(dir, name);
        const stat = fs.lstatSync(file);
        if (stat.isSymbolicLink() || stat.dev !== anchor.dev ||
            (uid !== undefined && stat.uid !== uid)) return false;
        if (stat.isDirectory()) {
          if (depth >= MAX_TEMPLATE_DEPTH) return false;
          stack.push({ dir: file, depth: depth + 1 });
        } else if (!stat.isFile() || stat.nlink !== 1 ||
                   !Number.isSafeInteger(stat.size) || stat.size < 0 ||
                   stat.size > MAX_TEMPLATE_FILE_BYTES) {
          return false;
        } else {
          totalBytes += stat.size;
          if (totalBytes > MAX_TEMPLATE_TOTAL_BYTES) return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}
